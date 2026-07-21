import { Router } from "express";
import { db } from "@workspace/db";
import {
  conversationsTable,
  conversationParticipantsTable,
  messagesTable,
  usersTable,
} from "@workspace/db";
import { eq, and, desc, ne } from "drizzle-orm";
import {
  CreateConversationBody,
  ListMessagesParams,
  SendMessageParams,
  SendMessageBody,
} from "@workspace/api-zod";

export const conversationsRouter = Router();
const DEFAULT_USER_ID = 1;

// GET /conversations
conversationsRouter.get("/", async (req, res) => {
  const myConvos = await db
    .select({ conversationId: conversationParticipantsTable.conversationId })
    .from(conversationParticipantsTable)
    .where(eq(conversationParticipantsTable.userId, DEFAULT_USER_ID));

  const convIds = myConvos.map((c) => c.conversationId);
  if (convIds.length === 0) return void res.json([]);

  const conversations = await Promise.all(
    convIds.map(async (convId) => {
      const [conv] = await db
        .select()
        .from(conversationsTable)
        .where(eq(conversationsTable.id, convId));

      const [other] = await db
        .select({ userId: conversationParticipantsTable.userId })
        .from(conversationParticipantsTable)
        .where(
          and(
            eq(conversationParticipantsTable.conversationId, convId),
            ne(conversationParticipantsTable.userId, DEFAULT_USER_ID)
          )
        );

      if (!other) return null;

      const [otherUser] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, other.userId));

      const [lastMsg] = await db
        .select()
        .from(messagesTable)
        .where(eq(messagesTable.conversationId, convId))
        .orderBy(desc(messagesTable.createdAt))
        .limit(1);

      return {
        id: convId,
        participantId: other.userId,
        participantUsername: otherUser?.username ?? "Unknown",
        participantAvatarUrl: otherUser?.avatarUrl ?? null,
        lastMessage: lastMsg?.content ?? null,
        lastMessageAt: lastMsg?.createdAt.toISOString() ?? null,
        unreadCount: 0,
        createdAt: conv.createdAt.toISOString(),
      };
    })
  );

  return res.json(conversations.filter(Boolean));
});

// POST /conversations
conversationsRouter.post("/", async (req, res) => {
  const body = CreateConversationBody.parse(req.body);

  // Check if conversation already exists
  const myConvos = await db
    .select({ conversationId: conversationParticipantsTable.conversationId })
    .from(conversationParticipantsTable)
    .where(eq(conversationParticipantsTable.userId, DEFAULT_USER_ID));

  const otherConvos = await db
    .select({ conversationId: conversationParticipantsTable.conversationId })
    .from(conversationParticipantsTable)
    .where(eq(conversationParticipantsTable.userId, body.participantId));

  const myIds = new Set(myConvos.map((c) => c.conversationId));
  const existingId = otherConvos.find((c) => myIds.has(c.conversationId))?.conversationId;

  if (existingId) {
    const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, existingId));
    const [otherUser] = await db.select().from(usersTable).where(eq(usersTable.id, body.participantId));
    return res.status(201).json({
      id: existingId,
      participantId: body.participantId,
      participantUsername: otherUser?.username ?? "Unknown",
      participantAvatarUrl: otherUser?.avatarUrl ?? null,
      lastMessage: null,
      lastMessageAt: null,
      unreadCount: 0,
      createdAt: conv.createdAt.toISOString(),
    });
  }

  const [conv] = await db.insert(conversationsTable).values({}).returning();
  await db.insert(conversationParticipantsTable).values([
    { conversationId: conv.id, userId: DEFAULT_USER_ID },
    { conversationId: conv.id, userId: body.participantId },
  ]);

  const [otherUser] = await db.select().from(usersTable).where(eq(usersTable.id, body.participantId));

  return res.status(201).json({
    id: conv.id,
    participantId: body.participantId,
    participantUsername: otherUser?.username ?? "Unknown",
    participantAvatarUrl: otherUser?.avatarUrl ?? null,
    lastMessage: null,
    lastMessageAt: null,
    unreadCount: 0,
    createdAt: conv.createdAt.toISOString(),
  });
});

// GET /conversations/:id/messages
conversationsRouter.get("/:id/messages", async (req, res) => {
  const { id } = ListMessagesParams.parse({ id: Number(req.params.id) });
  const msgs = await db
    .select({
      id: messagesTable.id,
      conversationId: messagesTable.conversationId,
      senderId: messagesTable.senderId,
      senderUsername: usersTable.username,
      content: messagesTable.content,
      createdAt: messagesTable.createdAt,
    })
    .from(messagesTable)
    .leftJoin(usersTable, eq(messagesTable.senderId, usersTable.id))
    .where(eq(messagesTable.conversationId, id))
    .orderBy(messagesTable.createdAt);

  res.json(
    msgs.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      senderUsername: m.senderUsername ?? "Unknown",
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    }))
  );
});

// POST /conversations/:id/messages
conversationsRouter.post("/:id/messages", async (req, res) => {
  const { id } = SendMessageParams.parse({ id: Number(req.params.id) });
  const body = SendMessageBody.parse(req.body);

  const [msg] = await db
    .insert(messagesTable)
    .values({ conversationId: id, senderId: DEFAULT_USER_ID, content: body.content })
    .returning();

  const [user] = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, DEFAULT_USER_ID));

  res.status(201).json({
    id: msg.id,
    conversationId: msg.conversationId,
    senderId: msg.senderId,
    senderUsername: user?.username ?? "Unknown",
    content: msg.content,
    createdAt: msg.createdAt.toISOString(),
  });
});
