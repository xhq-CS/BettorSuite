import { Router } from "express";
import { db } from "@workspace/db";
import { groupsTable, groupMembersTable, groupMessagesTable, usersTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";

export const groupsRouter = Router();
const DEFAULT_USER_ID = 1;

// GET /groups
groupsRouter.get("/", async (req, res) => {
  const sport = req.query.sport as string | undefined;

  const groups = await db
    .select({
      id: groupsTable.id,
      name: groupsTable.name,
      description: groupsTable.description,
      sport: groupsTable.sport,
      avatarUrl: groupsTable.avatarUrl,
      creatorId: groupsTable.creatorId,
      createdAt: groupsTable.createdAt,
      memberCount: sql<number>`(SELECT count(*) FROM group_members WHERE group_id = ${groupsTable.id})::int`,
    })
    .from(groupsTable)
    .orderBy(desc(groupsTable.createdAt))
    .limit(50);

  const withMembership = await Promise.all(
    groups.map(async (g) => {
      const [membership] = await db
        .select()
        .from(groupMembersTable)
        .where(and(eq(groupMembersTable.groupId, g.id), eq(groupMembersTable.userId, DEFAULT_USER_ID)));
      return {
        ...g,
        sport: g.sport ?? null,
        avatarUrl: g.avatarUrl ?? null,
        createdAt: g.createdAt.toISOString(),
        isMember: !!membership,
        role: membership?.role ?? null,
      };
    })
  );

  return res.json(sport ? withMembership.filter((g) => g.sport === sport) : withMembership);
});

// POST /groups
groupsRouter.post("/", async (req, res) => {
  const { name, description, sport } = req.body as { name: string; description?: string; sport?: string };
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return void res.status(400).json({ error: "name is required" });
  }
  const body = { name: name.trim(), description: description?.trim(), sport: sport?.trim() };

  const [group] = await db
    .insert(groupsTable)
    .values({ ...body, creatorId: DEFAULT_USER_ID })
    .returning();

  // Creator auto-joins as admin
  await db.insert(groupMembersTable).values({
    groupId: group.id,
    userId: DEFAULT_USER_ID,
    role: "admin",
  });

  return res.status(201).json({
    id: group.id,
    name: group.name,
    description: group.description ?? null,
    sport: group.sport ?? null,
    avatarUrl: null,
    creatorId: group.creatorId,
    memberCount: 1,
    isMember: true,
    role: "admin",
    createdAt: group.createdAt.toISOString(),
  });
});

// GET /groups/:id
groupsRouter.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, id));
  if (!group) return void res.status(404).json({ error: "Group not found" });

  const members = await db
    .select({
      userId: groupMembersTable.userId,
      username: usersTable.username,
      avatarUrl: usersTable.avatarUrl,
      role: groupMembersTable.role,
      joinedAt: groupMembersTable.joinedAt,
    })
    .from(groupMembersTable)
    .leftJoin(usersTable, eq(groupMembersTable.userId, usersTable.id))
    .where(eq(groupMembersTable.groupId, id));

  const myMembership = members.find((m) => m.userId === DEFAULT_USER_ID);

  return res.json({
    id: group.id,
    name: group.name,
    description: group.description ?? null,
    sport: group.sport ?? null,
    avatarUrl: group.avatarUrl ?? null,
    creatorId: group.creatorId,
    createdAt: group.createdAt.toISOString(),
    memberCount: members.length,
    isMember: !!myMembership,
    role: myMembership?.role ?? null,
    members: members.map((m) => ({
      userId: m.userId,
      username: m.username ?? "Unknown",
      avatarUrl: m.avatarUrl ?? null,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
    })),
  });
});

// POST /groups/:id/join
groupsRouter.post("/:id/join", async (req, res) => {
  const id = Number(req.params.id);
  const [existing] = await db
    .select()
    .from(groupMembersTable)
    .where(and(eq(groupMembersTable.groupId, id), eq(groupMembersTable.userId, DEFAULT_USER_ID)));

  if (existing) {
    // Leave group
    await db
      .delete(groupMembersTable)
      .where(and(eq(groupMembersTable.groupId, id), eq(groupMembersTable.userId, DEFAULT_USER_ID)));
    return res.json({ isMember: false });
  }

  await db.insert(groupMembersTable).values({ groupId: id, userId: DEFAULT_USER_ID, role: "member" });
  return res.json({ isMember: true });
});

// GET /groups/:id/messages
groupsRouter.get("/:id/messages", async (req, res) => {
  const id = Number(req.params.id);
  const msgs = await db
    .select({
      id: groupMessagesTable.id,
      groupId: groupMessagesTable.groupId,
      senderId: groupMessagesTable.senderId,
      senderUsername: usersTable.username,
      senderAvatar: usersTable.avatarUrl,
      content: groupMessagesTable.content,
      createdAt: groupMessagesTable.createdAt,
    })
    .from(groupMessagesTable)
    .leftJoin(usersTable, eq(groupMessagesTable.senderId, usersTable.id))
    .where(eq(groupMessagesTable.groupId, id))
    .orderBy(groupMessagesTable.createdAt)
    .limit(100);

  return res.json(
    msgs.map((m) => ({
      id: m.id,
      groupId: m.groupId,
      senderId: m.senderId,
      senderUsername: m.senderUsername ?? "Unknown",
      senderAvatar: m.senderAvatar ?? null,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    }))
  );
});

// POST /groups/:id/messages
groupsRouter.post("/:id/messages", async (req, res) => {
  const id = Number(req.params.id);
  const { content } = req.body as { content: string };
  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return void res.status(400).json({ error: "content is required" });
  }

  const [msg] = await db
    .insert(groupMessagesTable)
    .values({ groupId: id, senderId: DEFAULT_USER_ID, content })
    .returning();

  const [user] = await db
    .select({ username: usersTable.username, avatarUrl: usersTable.avatarUrl })
    .from(usersTable)
    .where(eq(usersTable.id, DEFAULT_USER_ID));

  return res.status(201).json({
    id: msg.id,
    groupId: msg.groupId,
    senderId: msg.senderId,
    senderUsername: user?.username ?? "Unknown",
    senderAvatar: user?.avatarUrl ?? null,
    content: msg.content,
    createdAt: msg.createdAt.toISOString(),
  });
});
