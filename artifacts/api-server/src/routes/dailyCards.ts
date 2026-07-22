import { Router } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  betsTable,
  conversationParticipantsTable,
  dailyCardsTable,
  db,
  groupMessagesTable,
  messagesTable,
  postsTable,
} from "@workspace/db";
import type { AuthRequest } from "../middleware/auth";
import { trackerBetSnapshot } from "../lib/betSnapshots";
import { getDailyCard } from "../lib/dailyCards";
import {
  groupPostingStatus,
  POSTING_DISABLED_MESSAGE,
  warRoomPostingStatus,
} from "../lib/moderation";

export const dailyCardsRouter = Router();
const currentUserId = (req: unknown) => (req as AuthRequest).userId;

async function isConversationMember(conversationId: number, userId: number) {
  const [participant] = await db
    .select({ id: conversationParticipantsTable.id })
    .from(conversationParticipantsTable)
    .where(
      and(
        eq(conversationParticipantsTable.conversationId, conversationId),
        eq(conversationParticipantsTable.userId, userId),
      ),
    );
  return Boolean(participant);
}

dailyCardsRouter.get("/mine", async (req, res) => {
  const rows = await db
    .select({ id: dailyCardsTable.id })
    .from(dailyCardsTable)
    .where(eq(dailyCardsTable.userId, currentUserId(req)))
    .orderBy(desc(dailyCardsTable.createdAt))
    .limit(50);
  const cards = await Promise.all(rows.map((row) => getDailyCard(row.id)));
  return res.json(cards.filter(Boolean));
});

dailyCardsRouter.get("/:id", async (req, res) => {
  const card = await getDailyCard(Number(req.params.id));
  if (!card) return void res.status(404).json({ error: "Daily card not found" });
  return res.json(card);
});

dailyCardsRouter.delete("/:id", async (req, res) => {
  const cardId = Number(req.params.id);
  const userId = currentUserId(req);
  const [card] = await db
    .select({ userId: dailyCardsTable.userId })
    .from(dailyCardsTable)
    .where(eq(dailyCardsTable.id, cardId));
  if (!card) return void res.status(204).send();
  if (card.userId !== userId)
    return void res.status(403).json({ error: "You can only remove your own daily card" });
  await db.transaction(async (tx) => {
    await tx.delete(postsTable).where(eq(postsTable.dailyCardId, cardId));
    await tx.delete(groupMessagesTable).where(eq(groupMessagesTable.dailyCardId, cardId));
    await tx.delete(messagesTable).where(eq(messagesTable.dailyCardId, cardId));
    await tx.delete(dailyCardsTable).where(eq(dailyCardsTable.id, cardId));
  });
  return res.status(204).send();
});

dailyCardsRouter.post("/", async (req, res) => {
  const userId = currentUserId(req);
  const title = String(req.body.title ?? "").trim();
  const note = String(req.body.note ?? "").trim();
  const destination = String(req.body.destination ?? "");
  const groupId = Number(req.body.groupId);
  const conversationId = Number(req.body.conversationId);
  const rawBetIds: unknown[] = Array.isArray(req.body.betIds)
    ? req.body.betIds
    : [];
  const betIds: number[] = [...new Set(rawBetIds.map((value) => Number(value)))].filter(
    (id) => Number.isInteger(id) && id > 0,
  );

  if (!title || title.length > 80)
    return void res.status(400).json({ error: "Card title must be 1-80 characters" });
  if (note.length > 600)
    return void res.status(400).json({ error: "Card note cannot exceed 600 characters" });
  if (betIds.length < 3 || betIds.length > 12)
    return void res.status(400).json({ error: "Choose 3-12 tracked picks for a daily card" });
  if (!["war-room", "group", "dm"].includes(destination))
    return void res.status(400).json({ error: "Choose where to post this card" });
  if (destination === "group" && !Number.isInteger(groupId))
    return void res.status(400).json({ error: "Choose a group" });
  if (destination === "dm" && !Number.isInteger(conversationId))
    return void res
      .status(400)
      .json({ error: "Choose a direct-message conversation" });

  const bets = await db
    .select()
    .from(betsTable)
    .where(and(eq(betsTable.userId, userId), inArray(betsTable.id, betIds)));
  if (bets.length !== betIds.length)
    return void res.status(400).json({ error: "One or more selected picks are unavailable" });
  const byId = new Map(bets.map((bet) => [bet.id, bet]));
  const now = new Date();
  const picks = betIds.map((id) => trackerBetSnapshot(byId.get(id)!, now));
  const leagues = [
    ...new Set(
      picks.map((pick) => pick.sport?.trim() || "Other").filter(Boolean),
    ),
  ];
  const content = note || `${title} · ${picks.length} picks`;

  if (destination === "war-room" && (await warRoomPostingStatus(userId)).muted)
    return void res
      .status(403)
      .json({ error: POSTING_DISABLED_MESSAGE });
  if (destination === "group") {
    const posting = await groupPostingStatus(groupId, userId);
    if (!posting.isMember)
      return void res
        .status(403)
        .json({ error: "Join this group before posting a card" });
    if (posting.muted)
      return void res
        .status(403)
        .json({ error: POSTING_DISABLED_MESSAGE });
  }

  let cardId: number;
  try {
    cardId = await db.transaction(async (tx) => {
      if (destination === "dm") {
        const member = await isConversationMember(conversationId, userId);
        if (!member) throw new Error("Conversation not found");
      }

      const [card] = await tx
        .insert(dailyCardsTable)
        .values({ userId, title, note: note || null, leagues, picks, cardDate: now })
        .returning({ id: dailyCardsTable.id });
      if (destination === "war-room") {
        await tx.insert(postsTable).values({ userId, content, dailyCardId: card.id });
      } else if (destination === "group") {
        await tx.insert(groupMessagesTable).values({
          groupId,
          senderId: userId,
          content,
          dailyCardId: card.id,
        });
      } else {
        await tx.insert(messagesTable).values({
          conversationId,
          senderId: userId,
          content,
          dailyCardId: card.id,
        });
      }
      return card.id;
    });
  } catch (error) {
    if (error instanceof Error && [
      "Choose a group",
      "Join this group before posting a card",
      "Choose a direct-message conversation",
      "Conversation not found",
    ].includes(error.message))
      return void res.status(400).json({ error: error.message });
    throw error;
  }

  const card = await getDailyCard(cardId);
  return res.status(201).json(card);
});
