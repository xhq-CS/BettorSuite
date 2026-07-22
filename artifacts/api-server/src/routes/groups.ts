import { Router } from "express";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import {
  db,
  groupInvitesTable,
  groupMembersTable,
  groupMessagesTable,
  groupsTable,
  usersTable,
} from "@workspace/db";
import type { AuthRequest } from "../middleware/auth";
import { getDailyCard } from "../lib/dailyCards";

export const groupsRouter = Router();
const uid = (req: unknown) => (req as AuthRequest).userId;
async function membership(groupId: number, userId: number) {
  const [row] = await db
    .select()
    .from(groupMembersTable)
    .where(
      and(
        eq(groupMembersTable.groupId, groupId),
        eq(groupMembersTable.userId, userId),
      ),
    );
  return row;
}
async function requireMember(groupId: number, userId: number) {
  return membership(groupId, userId);
}
async function groupById(groupId: number) {
  const [group] = await db
    .select()
    .from(groupsTable)
    .where(eq(groupsTable.id, groupId));
  return group;
}

async function ownedGroup(groupId: number, userId: number) {
  const group = await groupById(groupId);
  return group?.creatorId === userId ? group : undefined;
}

groupsRouter.get("/", async (req, res) => {
  const userId = uid(req);
  const search = String(req.query.search ?? "")
    .trim()
    .slice(0, 80);
  const rows = await db
    .select({
      id: groupsTable.id,
      name: groupsTable.name,
      description: groupsTable.description,
      creatorId: groupsTable.creatorId,
      createdAt: groupsTable.createdAt,
      memberCount: sql<number>`(SELECT count(*) FROM group_members WHERE group_id = ${groupsTable.id})::int`,
    })
    .from(groupsTable)
    .where(
      search
        ? or(
            ilike(groupsTable.name, `%${search}%`),
            ilike(groupsTable.description, `%${search}%`),
          )
        : undefined,
    )
    .orderBy(desc(groupsTable.createdAt))
    .limit(50);
  const result = await Promise.all(
    rows.map(async (group) => {
      const member = await membership(group.id, userId);
      return {
        ...group,
        createdAt: group.createdAt.toISOString(),
        isMember: !!member,
        role: member?.role ?? null,
      };
    }),
  );
  return res.json(result);
});
groupsRouter.post("/", async (req, res) => {
  const userId = uid(req);
  const name = String(req.body.name ?? "").trim();
  const description = String(req.body.description ?? "").trim();
  if (!name)
    return void res.status(400).json({ error: "Group name is required" });
  const [group] = await db
    .insert(groupsTable)
    .values({ name, description: description || null, creatorId: userId })
    .returning();
  await db
    .insert(groupMembersTable)
    .values({ groupId: group.id, userId, role: "admin" });
  res
    .status(201)
    .json({
      ...group,
      memberCount: 1,
      isMember: true,
      role: "admin",
      createdAt: group.createdAt.toISOString(),
    });
});
groupsRouter.get("/:id", async (req, res) => {
  const groupId = Number(req.params.id);
  const userId = uid(req);
  const group = await groupById(groupId);
  if (!group) return void res.status(404).json({ error: "Group not found" });
  const members = await db
    .select({
      userId: groupMembersTable.userId,
      username: usersTable.username,
      role: groupMembersTable.role,
      joinedAt: groupMembersTable.joinedAt,
    })
    .from(groupMembersTable)
    .innerJoin(usersTable, eq(groupMembersTable.userId, usersTable.id))
    .where(eq(groupMembersTable.groupId, groupId));
  const mine = members.find((member) => member.userId === userId);
  const isOwner = group.creatorId === userId;
  const invites = isOwner
    ? await db
        .select({
          id: groupInvitesTable.id,
          userId: groupInvitesTable.userId,
          status: groupInvitesTable.status,
        })
        .from(groupInvitesTable)
        .where(
          and(
            eq(groupInvitesTable.groupId, groupId),
            eq(groupInvitesTable.status, "pending"),
          ),
        )
    : [];
  return res.json({
    ...group,
    createdAt: group.createdAt.toISOString(),
    memberCount: members.length,
    isMember: Boolean(mine),
    isOwner,
    role: mine?.role ?? null,
    members: members.map((member) => ({
      ...member,
      joinedAt: member.joinedAt.toISOString(),
    })),
    invites,
  });
});

groupsRouter.patch("/:id", async (req, res) => {
  const groupId = Number(req.params.id);
  const userId = uid(req);
  const group = await ownedGroup(groupId, userId);
  if (!group) {
    return void res
      .status(403)
      .json({ error: "Only the group owner can edit this group" });
  }
  const name = String(req.body.name ?? "").trim();
  const description = String(req.body.description ?? "").trim();
  if (name.length < 2 || name.length > 60) {
    return void res
      .status(400)
      .json({ error: "Group name must be 2-60 characters" });
  }
  if (description.length > 240) {
    return void res
      .status(400)
      .json({ error: "Group description must be 240 characters or fewer" });
  }
  const [updated] = await db
    .update(groupsTable)
    .set({ name, description: description || null })
    .where(eq(groupsTable.id, groupId))
    .returning();
  return res.json({
    ...updated,
    createdAt: updated.createdAt.toISOString(),
    isOwner: true,
  });
});

groupsRouter.delete("/:id", async (req, res) => {
  const groupId = Number(req.params.id);
  const userId = uid(req);
  const group = await ownedGroup(groupId, userId);
  if (!group) {
    return void res
      .status(403)
      .json({ error: "Only the group owner can delete this group" });
  }
  await db.transaction(async (tx) => {
    await tx
      .delete(groupInvitesTable)
      .where(eq(groupInvitesTable.groupId, groupId));
    await tx
      .delete(groupMessagesTable)
      .where(eq(groupMessagesTable.groupId, groupId));
    await tx
      .delete(groupMembersTable)
      .where(eq(groupMembersTable.groupId, groupId));
    await tx.delete(groupsTable).where(eq(groupsTable.id, groupId));
  });
  return res.status(204).send();
});
groupsRouter.post("/:id/join", async (req, res) => {
  const groupId = Number(req.params.id),
    userId = uid(req);
  const existing = await membership(groupId, userId);
  if (existing) return res.json({ isMember: true });
  await db
    .insert(groupMembersTable)
    .values({ groupId, userId, role: "member" });
  await db
    .update(groupInvitesTable)
    .set({ status: "accepted" })
    .where(
      and(
        eq(groupInvitesTable.groupId, groupId),
        eq(groupInvitesTable.userId, userId),
        eq(groupInvitesTable.status, "pending"),
      ),
    );
  return res.json({ isMember: true });
});
groupsRouter.get("/:id/messages", async (req, res) => {
  const groupId = Number(req.params.id),
    userId = uid(req);
  if (!(await requireMember(groupId, userId)))
    return void res
      .status(403)
      .json({ error: "Join this group to view messages" });
  const rows = await db
    .select({
      id: groupMessagesTable.id,
      senderId: groupMessagesTable.senderId,
      senderUsername: usersTable.username,
      content: groupMessagesTable.content,
      betShare: groupMessagesTable.betShare,
      dailyCardId: groupMessagesTable.dailyCardId,
      createdAt: groupMessagesTable.createdAt,
      editedAt: groupMessagesTable.editedAt,
    })
    .from(groupMessagesTable)
    .innerJoin(usersTable, eq(groupMessagesTable.senderId, usersTable.id))
    .where(eq(groupMessagesTable.groupId, groupId))
    .orderBy(groupMessagesTable.createdAt)
    .limit(200);
  res.json(
    await Promise.all(
      rows.map(async (m) => ({
        ...m,
        betShare: m.betShare ?? null,
        dailyCard: await getDailyCard(m.dailyCardId),
        createdAt: m.createdAt.toISOString(),
        editedAt: m.editedAt?.toISOString() ?? null,
      })),
    ),
  );
});
groupsRouter.post("/:id/messages", async (req, res) => {
  const groupId = Number(req.params.id),
    userId = uid(req),
    content = String(req.body.content ?? "").trim();
  if (!(await requireMember(groupId, userId)))
    return void res
      .status(403)
      .json({ error: "Join this group to send messages" });
  if (!content || content.length > 2000)
    return void res
      .status(400)
      .json({ error: "Message must be 1–2000 characters" });
  const [msg] = await db
    .insert(groupMessagesTable)
    .values({ groupId, senderId: userId, content })
    .returning();
  res.status(201).json(msg);
});
groupsRouter.patch("/:id/messages/:messageId", async (req, res) => {
  const groupId = Number(req.params.id),
    messageId = Number(req.params.messageId),
    userId = uid(req),
    content = String(req.body.content ?? "").trim();
  if (!(await requireMember(groupId, userId)))
    return void res
      .status(403)
      .json({ error: "Join this group to edit messages" });
  if (!content || content.length > 2000)
    return void res
      .status(400)
      .json({ error: "Message must be 1-2000 characters" });
  const [existing] = await db
    .select()
    .from(groupMessagesTable)
    .where(
      and(
        eq(groupMessagesTable.id, messageId),
        eq(groupMessagesTable.groupId, groupId),
      ),
    );
  if (!existing)
    return void res.status(404).json({ error: "Message not found" });
  if (existing.senderId !== userId)
    return void res
      .status(403)
      .json({ error: "You can only edit your own message" });
  const [message] = await db
    .update(groupMessagesTable)
    .set({ content, editedAt: new Date() })
    .where(eq(groupMessagesTable.id, messageId))
    .returning();
  return res.json({
    ...message,
    createdAt: message.createdAt.toISOString(),
    editedAt: message.editedAt?.toISOString() ?? null,
  });
});
groupsRouter.delete("/:id/messages/:messageId", async (req, res) => {
  const groupId = Number(req.params.id),
    messageId = Number(req.params.messageId),
    userId = uid(req);
  if (!(await requireMember(groupId, userId)))
    return void res
      .status(403)
      .json({ error: "Join this group to delete messages" });
  const [existing] = await db
    .select()
    .from(groupMessagesTable)
    .where(
      and(
        eq(groupMessagesTable.id, messageId),
        eq(groupMessagesTable.groupId, groupId),
      ),
    );
  if (!existing)
    return void res.status(404).json({ error: "Message not found" });
  if (existing.senderId !== userId)
    return void res
      .status(403)
      .json({ error: "You can only delete your own message" });
  await db
    .delete(groupMessagesTable)
    .where(eq(groupMessagesTable.id, messageId));
  return res.status(204).send();
});
groupsRouter.post("/:id/members", async (req, res) => {
  const groupId = Number(req.params.id),
    userId = uid(req),
    newUserId = Number(req.body.userId);
  if (!(await ownedGroup(groupId, userId)))
    return void res
      .status(403)
      .json({ error: "Only the group owner can add members" });
  if (!Number.isInteger(newUserId))
    return void res.status(400).json({ error: "Valid user is required" });
  if (!(await membership(groupId, newUserId)))
    await db
      .insert(groupMembersTable)
      .values({ groupId, userId: newUserId, role: "member" });
  res.status(201).json({ added: true });
});
groupsRouter.post("/:id/invite", async (req, res) => {
  const groupId = Number(req.params.id),
    userId = uid(req),
    invitedUserId = Number(req.body.userId);
  const group = await ownedGroup(groupId, userId);
  if (!group)
    return void res
      .status(403)
      .json({ error: "Only the group owner can invite members" });
  const [target] = await db
    .select({ username: usersTable.username })
    .from(usersTable)
    .where(eq(usersTable.id, invitedUserId));
  if (!target) return void res.status(404).json({ error: "User not found" });
  if (await membership(groupId, invitedUserId))
    return void res.status(409).json({ error: "User is already a member" });
  const [pending] = await db
    .select()
    .from(groupInvitesTable)
    .where(
      and(
        eq(groupInvitesTable.groupId, groupId),
        eq(groupInvitesTable.userId, invitedUserId),
        eq(groupInvitesTable.status, "pending"),
      ),
    );
  if (!pending)
    await db
      .insert(groupInvitesTable)
      .values({
        groupId,
        userId: invitedUserId,
        invitedBy: userId,
        status: "pending",
      });
  return res.json({
    invited: true,
    message: `@${target.username} was invited to ${group.name}`,
  });
});
groupsRouter.delete("/:id/members/:userId", async (req, res) => {
  const groupId = Number(req.params.id),
    actorId = uid(req),
    removeId = Number(req.params.userId);
  const group = await ownedGroup(groupId, actorId);
  if (!group)
    return void res
      .status(403)
      .json({ error: "Only the group owner can remove members" });
  if (removeId === group.creatorId)
    return void res
      .status(400)
      .json({ error: "The group owner cannot be removed" });
  const target = await membership(groupId, removeId);
  if (!target) return void res.status(404).json({ error: "Member not found" });
  await db
    .delete(groupMembersTable)
    .where(
      and(
        eq(groupMembersTable.groupId, groupId),
        eq(groupMembersTable.userId, removeId),
      ),
    );
  await db
    .delete(groupInvitesTable)
    .where(
      and(
        eq(groupInvitesTable.groupId, groupId),
        eq(groupInvitesTable.userId, removeId),
      ),
    );
  return res.status(204).send();
});
