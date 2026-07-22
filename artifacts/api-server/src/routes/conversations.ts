import { Router } from "express";
import { and, desc, eq, gt, inArray, ne, sql } from "drizzle-orm";
import {
  conversationParticipantsTable,
  conversationsTable,
  db,
  messagesTable,
  usersTable,
} from "@workspace/db";
import type { AuthRequest } from "../middleware/auth";
import { getDailyCard } from "../lib/dailyCards";

export const conversationsRouter = Router();
const currentUserId = (req: unknown) => (req as AuthRequest).userId;

async function participant(conversationId: number, userId: number) {
  const [row] = await db
    .select()
    .from(conversationParticipantsTable)
    .where(
      and(
        eq(conversationParticipantsTable.conversationId, conversationId),
        eq(conversationParticipantsTable.userId, userId),
      ),
    );
  return row;
}

async function formatMessage(message: typeof messagesTable.$inferSelect) {
  const [sender, dailyCard] = await Promise.all([
    db
      .select({ username: usersTable.username, avatarUrl: usersTable.avatarUrl })
      .from(usersTable)
      .where(eq(usersTable.id, message.senderId))
      .then((rows) => rows[0]),
    getDailyCard(message.dailyCardId),
  ]);
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    senderUsername: sender?.username ?? "Unknown",
    senderAvatarUrl: sender?.avatarUrl ?? null,
    content: message.content,
    betShare: message.betShare ?? null,
    dailyCard,
    createdAt: message.createdAt.toISOString(),
    editedAt: message.editedAt?.toISOString() ?? null,
  };
}

conversationsRouter.get("/", async (req, res) => {
  const userId = currentUserId(req);
  const mine = await db
    .select({
      conversationId: conversationParticipantsTable.conversationId,
      lastReadAt: conversationParticipantsTable.lastReadAt,
    })
    .from(conversationParticipantsTable)
    .where(eq(conversationParticipantsTable.userId, userId));
  if (!mine.length) return res.json([]);

  const conversations = await Promise.all(
    mine.map(async ({ conversationId, lastReadAt }) => {
      const [[other], [lastMessage], [unread]] = await Promise.all([
        db
          .select({
            id: usersTable.id,
            username: usersTable.username,
            displayName: usersTable.displayName,
            avatarUrl: usersTable.avatarUrl,
          })
          .from(conversationParticipantsTable)
          .innerJoin(
            usersTable,
            eq(conversationParticipantsTable.userId, usersTable.id),
          )
          .where(
            and(
              eq(conversationParticipantsTable.conversationId, conversationId),
              ne(conversationParticipantsTable.userId, userId),
            ),
          )
          .limit(1),
        db
          .select()
          .from(messagesTable)
          .where(eq(messagesTable.conversationId, conversationId))
          .orderBy(desc(messagesTable.createdAt))
          .limit(1),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(messagesTable)
          .where(
            and(
              eq(messagesTable.conversationId, conversationId),
              ne(messagesTable.senderId, userId),
              lastReadAt ? gt(messagesTable.createdAt, lastReadAt) : undefined,
            ),
          ),
      ]);
      if (!other) return null;
      return {
        id: conversationId,
        participantId: other.id,
        participantUsername: other.username,
        participantDisplayName: other.displayName ?? null,
        participantAvatarUrl: other.avatarUrl ?? null,
        lastMessage: lastMessage
          ? lastMessage.dailyCardId
            ? "Shared a daily card"
            : lastMessage.betShare
              ? "Shared a pick"
              : lastMessage.content
          : null,
        lastMessageAt: lastMessage?.createdAt.toISOString() ?? null,
        unreadCount: unread?.count ?? 0,
      };
    }),
  );
  return res.json(
    conversations
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) =>
        String(b.lastMessageAt ?? "").localeCompare(String(a.lastMessageAt ?? "")),
      ),
  );
});

conversationsRouter.post("/", async (req, res) => {
  const userId = currentUserId(req);
  const targetId = Number(req.body.participantId);
  if (!Number.isInteger(targetId) || targetId <= 0 || targetId === userId)
    return void res.status(400).json({ error: "Choose another bettor" });
  const [target] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.id, targetId));
  if (!target) return void res.status(404).json({ error: "Bettor not found" });

  const myConversations = await db
    .select({ conversationId: conversationParticipantsTable.conversationId })
    .from(conversationParticipantsTable)
    .where(eq(conversationParticipantsTable.userId, userId));
  if (myConversations.length) {
    const ids = myConversations.map((row) => row.conversationId);
    const targetRows = await db
      .select({ conversationId: conversationParticipantsTable.conversationId })
      .from(conversationParticipantsTable)
      .where(
        and(
          inArray(conversationParticipantsTable.conversationId, ids),
          eq(conversationParticipantsTable.userId, targetId),
        ),
      );
    if (targetRows[0]) return res.status(200).json({ id: targetRows[0].conversationId });
  }

  const [conversation] = await db.transaction(async (tx) => {
    const rows = await tx.insert(conversationsTable).values({}).returning();
    await tx.insert(conversationParticipantsTable).values([
      { conversationId: rows[0].id, userId },
      { conversationId: rows[0].id, userId: targetId },
    ]);
    return rows;
  });
  return res.status(201).json({ id: conversation.id });
});

conversationsRouter.get("/:id/messages", async (req, res) => {
  const conversationId = Number(req.params.id);
  const userId = currentUserId(req);
  if (!Number.isInteger(conversationId) || !(await participant(conversationId, userId)))
    return void res.status(404).json({ error: "Conversation not found" });
  const rows = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, conversationId))
    .orderBy(messagesTable.createdAt)
    .limit(300);
  await db
    .update(conversationParticipantsTable)
    .set({ lastReadAt: sql`now()` })
    .where(
      and(
        eq(conversationParticipantsTable.conversationId, conversationId),
        eq(conversationParticipantsTable.userId, userId),
      ),
    );
  return res.json(await Promise.all(rows.map(formatMessage)));
});

conversationsRouter.post("/:id/messages", async (req, res) => {
  const conversationId = Number(req.params.id);
  const userId = currentUserId(req);
  const content = String(req.body.content ?? "").trim();
  if (!Number.isInteger(conversationId) || !(await participant(conversationId, userId)))
    return void res.status(404).json({ error: "Conversation not found" });
  if (!content || content.length > 2000)
    return void res.status(400).json({ error: "Message must be 1-2000 characters" });
  const [message] = await db
    .insert(messagesTable)
    .values({ conversationId, senderId: userId, content })
    .returning();
  return res.status(201).json(await formatMessage(message));
});

conversationsRouter.patch("/:id/messages/:messageId", async (req, res) => {
  const conversationId = Number(req.params.id);
  const messageId = Number(req.params.messageId);
  const userId = currentUserId(req);
  const content = String(req.body.content ?? "").trim();
  if (!content || content.length > 2000)
    return void res.status(400).json({ error: "Message must be 1-2000 characters" });
  const [existing] = await db
    .select()
    .from(messagesTable)
    .where(
      and(
        eq(messagesTable.id, messageId),
        eq(messagesTable.conversationId, conversationId),
      ),
    );
  if (!existing || !(await participant(conversationId, userId)))
    return void res.status(404).json({ error: "Message not found" });
  if (existing.senderId !== userId)
    return void res.status(403).json({ error: "You can only edit your own message" });
  const [message] = await db
    .update(messagesTable)
    .set({ content, editedAt: new Date() })
    .where(eq(messagesTable.id, messageId))
    .returning();
  return res.json(await formatMessage(message));
});

conversationsRouter.delete("/:id/messages/:messageId", async (req, res) => {
  const conversationId = Number(req.params.id);
  const messageId = Number(req.params.messageId);
  const userId = currentUserId(req);
  const [existing] = await db
    .select()
    .from(messagesTable)
    .where(
      and(
        eq(messagesTable.id, messageId),
        eq(messagesTable.conversationId, conversationId),
      ),
    );
  if (!existing || !(await participant(conversationId, userId)))
    return void res.status(404).json({ error: "Message not found" });
  if (existing.senderId !== userId)
    return void res.status(403).json({ error: "You can only delete your own message" });
  await db.delete(messagesTable).where(eq(messagesTable.id, messageId));
  return res.status(204).send();
});
