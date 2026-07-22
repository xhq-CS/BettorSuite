import { and, eq } from "drizzle-orm";
import { db, groupMembersTable, usersTable } from "@workspace/db";

export const POSTING_DISABLED_MESSAGE =
  "You do not have permission to send messages in this channel.";

export async function isPlatformAdmin(userId: number) {
  const [user] = await db
    .select({ role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  return user?.role === "admin";
}

export async function warRoomPostingStatus(userId: number) {
  const [user] = await db
    .select({ role: usersTable.role, muted: usersTable.warRoomMuted })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  return {
    isAdmin: user?.role === "admin",
    muted: user?.role === "admin" ? false : Boolean(user?.muted),
  };
}

export async function groupPostingStatus(groupId: number, userId: number) {
  if (await isPlatformAdmin(userId)) {
    return { isMember: true, muted: false, isAdmin: true };
  }
  const [member] = await db
    .select({ muted: groupMembersTable.muted })
    .from(groupMembersTable)
    .where(
      and(
        eq(groupMembersTable.groupId, groupId),
        eq(groupMembersTable.userId, userId),
      ),
    );
  return {
    isMember: Boolean(member),
    muted: Boolean(member?.muted),
    isAdmin: false,
  };
}
