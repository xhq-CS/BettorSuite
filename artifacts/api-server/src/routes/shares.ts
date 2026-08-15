import { Router } from "express";
import { and, eq } from "drizzle-orm";
import {
  betsTable,
  conversationParticipantsTable,
  db,
  groupMessagesTable,
  postsTable,
  messagesTable,
  simulatorBetsTable,
  type SharedBetSnapshot,
} from "@workspace/db";
import type { AuthRequest } from "../middleware/auth";
import { mockBetSnapshot, trackerBetSnapshot } from "../lib/betSnapshots";
import { conversationInteractionBlocked } from "../lib/safety";
import {
  groupPostingStatus,
  POSTING_DISABLED_MESSAGE,
  warRoomPostingStatus,
} from "../lib/moderation";

export const sharesRouter = Router();

function defaultShareNote(status: string) {
  if (status === "pending") return "Tail or fade?";
  if (status === "won") return "Cashed this one.";
  return "Sharing this bet slip.";
}

sharesRouter.post("/bet", async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const source =
    body.source === "tracker" || body.source === "mock" ? body.source : null;
  const destination = ["war-room", "group", "dm"].includes(
    String(body.destination),
  )
    ? (body.destination as "war-room" | "group" | "dm")
    : null;
  const betId = Number(body.betId);
  const groupId = body.groupId == null ? undefined : Number(body.groupId);
  const conversationId =
    body.conversationId == null ? undefined : Number(body.conversationId);
  const note = typeof body.note === "string" ? body.note.trim() : undefined;
  if (
    !source ||
    !destination ||
    !Number.isInteger(betId) ||
    betId <= 0 ||
    (note?.length ?? 0) > 500
  ) {
    return void res
      .status(400)
      .json({ error: "Choose a bet and valid destination" });
  }

  const userId = (req as AuthRequest).userId;
  const sharedAt = new Date().toISOString();

  let snapshot: SharedBetSnapshot;
  if (source === "tracker") {
    const [bet] = await db
      .select()
      .from(betsTable)
      .where(and(eq(betsTable.id, betId), eq(betsTable.userId, userId)));
    if (!bet)
      return void res.status(404).json({ error: "Tracked bet not found" });
    snapshot = trackerBetSnapshot(bet, new Date(sharedAt));
  } else {
    const [bet] = await db
      .select()
      .from(simulatorBetsTable)
      .where(
        and(
          eq(simulatorBetsTable.id, betId),
          eq(simulatorBetsTable.userId, userId),
        ),
      );
    if (!bet) return void res.status(404).json({ error: "Mock bet not found" });
    snapshot = mockBetSnapshot(bet, new Date(sharedAt));
  }

  const content = note || defaultShareNote(snapshot.status);
  if (destination === "war-room") {
    if ((await warRoomPostingStatus(userId)).muted)
      return void res
        .status(403)
        .json({ error: POSTING_DISABLED_MESSAGE });
    const [post] = await db
      .insert(postsTable)
      .values({ userId, content, betShare: snapshot })
      .returning({ id: postsTable.id });
    return void res.status(201).json({ id: post.id, destination });
  }

  if (destination === "dm") {
    if (!conversationId || !Number.isInteger(conversationId))
      return void res.status(400).json({ error: "Choose a conversation" });
    const [participant] = await db
      .select({ id: conversationParticipantsTable.id })
      .from(conversationParticipantsTable)
      .where(
        and(
          eq(conversationParticipantsTable.conversationId, conversationId),
          eq(conversationParticipantsTable.userId, userId),
        ),
      );
    if (!participant)
      return void res.status(404).json({ error: "Conversation not found" });
    if (await conversationInteractionBlocked(conversationId, userId))
      return void res.status(403).json({ error: "Sharing is unavailable between these accounts." });
    const [message] = await db
      .insert(messagesTable)
      .values({
        conversationId,
        senderId: userId,
        content,
        betShare: snapshot,
      })
      .returning({ id: messagesTable.id });
    return void res
      .status(201)
      .json({ id: message.id, destination, conversationId });
  }

  if (!groupId) {
    return void res.status(400).json({ error: "Choose a group" });
  }
  const posting = await groupPostingStatus(groupId, userId);
  if (!posting.isMember) {
    return void res
      .status(403)
      .json({ error: "Join this group before sharing" });
  }
  if (posting.muted)
    return void res
      .status(403)
      .json({ error: POSTING_DISABLED_MESSAGE });

  const [message] = await db
    .insert(groupMessagesTable)
    .values({ groupId, senderId: userId, content, betShare: snapshot })
    .returning({ id: groupMessagesTable.id });
  return void res.status(201).json({ id: message.id, destination, groupId });
});
