import { Router } from "express";
import { and, desc, eq, gt, ilike, ne, or, sql } from "drizzle-orm";
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
import {
  groupPostingStatus,
  isPlatformAdmin,
  POSTING_DISABLED_MESSAGE,
} from "../lib/moderation";
import { resolvedPresence } from "../lib/presence";
import { privateNicknameMap } from "../lib/socialIdentity";

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
  if (!group) return undefined;
  if (await isPlatformAdmin(userId)) return group;
  if (group.creatorId === userId) return group;

  // Group admins have the same moderation controls as the original owner.
  // This also supports groups created before creator_id was introduced.
  const member = await membership(groupId, userId);
  if (member?.role === "admin") return group;
  return undefined;
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
      const [member, [memberCountRow]] = await Promise.all([
        membership(group.id, userId),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(groupMembersTable)
          .where(eq(groupMembersTable.groupId, group.id)),
      ]);
      const [unread] =
        member && !member.notificationsMuted
          ? await db
              .select({ count: sql<number>`count(*)::int` })
              .from(groupMessagesTable)
              .where(
                and(
                  eq(groupMessagesTable.groupId, group.id),
                  ne(groupMessagesTable.senderId, userId),
                  gt(
                    groupMessagesTable.createdAt,
                    member.lastReadAt ?? member.joinedAt,
                  ),
                ),
              )
          : [];
      return {
        ...group,
        createdAt: group.createdAt.toISOString(),
        memberCount: memberCountRow?.count ?? 0,
        isMember: !!member,
        role: member?.role ?? null,
        notificationsMuted: Boolean(member?.notificationsMuted),
        unreadCount: unread?.count ?? 0,
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
    .values({ groupId: group.id, userId, role: "admin", lastReadAt: sql`now()` });
  res.status(201).json({
    ...group,
    memberCount: 1,
    isMember: true,
    role: "admin",
    notificationsMuted: false,
    unreadCount: 0,
    createdAt: group.createdAt.toISOString(),
  });
});
groupsRouter.get("/invites/pending", async (req, res) => {
  const userId = uid(req);
  const rows = await db
    .select({
      id: groupInvitesTable.id,
      groupId: groupInvitesTable.groupId,
      groupName: groupsTable.name,
      groupDescription: groupsTable.description,
      invitedBy: groupInvitesTable.invitedBy,
      createdAt: groupInvitesTable.createdAt,
    })
    .from(groupInvitesTable)
    .innerJoin(groupsTable, eq(groupInvitesTable.groupId, groupsTable.id))
    .where(
      and(
        eq(groupInvitesTable.userId, userId),
        eq(groupInvitesTable.status, "pending"),
      ),
    )
    .orderBy(desc(groupInvitesTable.createdAt))
    .limit(20);

  const result = await Promise.all(
    rows.map(async (invite) => {
      const [[inviter], [memberCountRow]] = await Promise.all([
        db
          .select({ username: usersTable.username })
          .from(usersTable)
          .where(eq(usersTable.id, invite.invitedBy)),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(groupMembersTable)
          .where(eq(groupMembersTable.groupId, invite.groupId)),
      ]);
      return {
        ...invite,
        invitedByUsername: inviter?.username ?? "bettor",
        memberCount: memberCountRow?.count ?? 0,
        createdAt: invite.createdAt.toISOString(),
      };
    }),
  );
  return res.json(result);
});
groupsRouter.post("/invites/:inviteId/decline", async (req, res) => {
  const inviteId = Number(req.params.inviteId);
  const userId = uid(req);
  if (!Number.isInteger(inviteId)) {
    return void res.status(400).json({ error: "Invalid invitation" });
  }
  const [invite] = await db
    .select()
    .from(groupInvitesTable)
    .where(
      and(
        eq(groupInvitesTable.id, inviteId),
        eq(groupInvitesTable.userId, userId),
        eq(groupInvitesTable.status, "pending"),
      ),
    );
  if (!invite) {
    return void res.status(404).json({ error: "Invitation not found" });
  }
  await db
    .update(groupInvitesTable)
    .set({ status: "declined" })
    .where(eq(groupInvitesTable.id, inviteId));
  return res.json({ declined: true });
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
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
      presenceStatus: usersTable.presenceStatus,
      presenceUpdatedAt: usersTable.presenceUpdatedAt,
      role: groupMembersTable.role,
      muted: groupMembersTable.muted,
      mutedAt: groupMembersTable.mutedAt,
      joinedAt: groupMembersTable.joinedAt,
    })
    .from(groupMembersTable)
    .innerJoin(usersTable, eq(groupMembersTable.userId, usersTable.id))
    .where(eq(groupMembersTable.groupId, groupId));
  const mine = members.find((member) => member.userId === userId);
  const viewerMembership = await membership(groupId, userId);
  const platformAdmin = await isPlatformAdmin(userId);
  const isOwner = group.creatorId === userId || mine?.role === "admin";
  const canManage = isOwner || platformAdmin;
  const nicknames = await privateNicknameMap(
    userId,
    members.map((member) => member.userId),
  );
  const invites = canManage
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
    canManage,
    isPlatformAdmin: platformAdmin,
    postingMuted: platformAdmin ? false : Boolean(mine?.muted),
    notificationsMuted: Boolean(viewerMembership?.notificationsMuted),
    role: mine?.role ?? null,
    members: members.map((member) => ({
      ...member,
      displayName: member.displayName ?? null,
      avatarUrl: member.avatarUrl ?? null,
      nickname: nicknames.get(member.userId) ?? null,
      presenceStatus: resolvedPresence(
        member.presenceStatus,
        member.presenceUpdatedAt,
      ),
      presenceUpdatedAt: undefined,
      muted: canManage ? member.muted : false,
      mutedAt: canManage ? member.mutedAt : null,
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
    .values({ groupId, userId, role: "member", lastReadAt: sql`now()` });
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
groupsRouter.patch("/:id/notifications", async (req, res) => {
  const groupId = Number(req.params.id);
  const userId = uid(req);
  const notificationsMuted = req.body.muted === true;
  const member = await membership(groupId, userId);
  if (!member)
    return void res.status(403).json({ error: "Join this group first" });
  await db
    .update(groupMembersTable)
    .set({ notificationsMuted, lastReadAt: sql`now()` })
    .where(eq(groupMembersTable.id, member.id));
  return res.json({ notificationsMuted });
});
groupsRouter.post("/:id/leave", async (req, res) => {
  const groupId = Number(req.params.id);
  const userId = uid(req);
  const group = await groupById(groupId);
  const member = await membership(groupId, userId);
  if (!group || !member)
    return void res.status(404).json({ error: "Group membership not found" });
  if (
    group.creatorId === userId ||
    (group.creatorId == null && member.role === "admin")
  )
    return void res
      .status(400)
      .json({ error: "Group owners must delete the group instead of leaving" });
  await db.transaction(async (tx) => {
    await tx
      .delete(groupMembersTable)
      .where(eq(groupMembersTable.id, member.id));
    await tx
      .delete(groupInvitesTable)
      .where(
        and(
          eq(groupInvitesTable.groupId, groupId),
          eq(groupInvitesTable.userId, userId),
        ),
      );
  });
  return res.status(204).send();
});
groupsRouter.get("/:id/messages", async (req, res) => {
  const groupId = Number(req.params.id),
    userId = uid(req);
  const member = await requireMember(groupId, userId);
  if (!member)
    return void res
      .status(403)
      .json({ error: "Join this group to view messages" });
  const rows = await db
    .select({
      id: groupMessagesTable.id,
      senderId: groupMessagesTable.senderId,
      senderUsername: usersTable.username,
      senderAvatarUrl: usersTable.avatarUrl,
      senderPresenceStatus: usersTable.presenceStatus,
      senderPresenceUpdatedAt: usersTable.presenceUpdatedAt,
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
  const nicknames = await privateNicknameMap(
    userId,
    rows.map((message) => message.senderId),
  );
  await db
    .update(groupMembersTable)
    .set({ lastReadAt: sql`now()` })
    .where(eq(groupMembersTable.id, member.id));
  res.json(
    await Promise.all(
      rows.map(async (m) => ({
        ...m,
        senderNickname: nicknames.get(m.senderId) ?? null,
        senderPresenceStatus: resolvedPresence(
          m.senderPresenceStatus,
          m.senderPresenceUpdatedAt,
        ),
        senderPresenceUpdatedAt: undefined,
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
  const posting = await groupPostingStatus(groupId, userId);
  if (!posting.isMember)
    return void res
      .status(403)
      .json({ error: "Join this group to send messages" });
  if (posting.muted)
    return void res
      .status(403)
      .json({ error: POSTING_DISABLED_MESSAGE });
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
  if (existing.senderId !== userId && !(await isPlatformAdmin(userId)))
    return void res
      .status(403)
      .json({ error: "Only the sender or platform admin can edit this message" });
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
  const canModerate = Boolean(await ownedGroup(groupId, userId));
  if (existing.senderId !== userId && !canModerate)
    return void res
      .status(403)
      .json({
        error: "Only the sender or a group admin can delete this message",
      });
  await db
    .delete(groupMessagesTable)
    .where(eq(groupMessagesTable.id, messageId));
  return res.status(204).send();
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
    await db.insert(groupInvitesTable).values({
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
groupsRouter.patch("/:id/members/:userId/mute", async (req, res) => {
  const groupId = Number(req.params.id);
  const actorId = uid(req);
  const targetId = Number(req.params.userId);
  const muted = req.body.muted === true;
  const group = await ownedGroup(groupId, actorId);
  if (!group)
    return void res
      .status(403)
      .json({ error: "Only the group owner or platform admin can mute members" });
  const platformAdmin = await isPlatformAdmin(actorId);
  if (!platformAdmin && (targetId === actorId || targetId === group.creatorId))
    return void res.status(400).json({ error: "The group owner cannot be muted" });
  const target = await membership(groupId, targetId);
  if (!target) return void res.status(404).json({ error: "Member not found" });
  await db
    .update(groupMembersTable)
    .set({
      muted,
      mutedAt: muted ? new Date() : null,
      mutedBy: muted ? actorId : null,
    })
    .where(
      and(
        eq(groupMembersTable.groupId, groupId),
        eq(groupMembersTable.userId, targetId),
      ),
    );
  return res.json({ muted });
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
  if (removeId === actorId || removeId === group.creatorId)
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
