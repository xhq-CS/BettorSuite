import { and, eq, ne, or } from "drizzle-orm";
import { conversationParticipantsTable, db, userBlocksTable } from "@workspace/db";

export async function interactionBlockState(firstUserId: number, secondUserId: number) {
  const rows = await db.select().from(userBlocksTable).where(or(
    and(eq(userBlocksTable.blockerId, firstUserId), eq(userBlocksTable.blockedId, secondUserId)),
    and(eq(userBlocksTable.blockerId, secondUserId), eq(userBlocksTable.blockedId, firstUserId)),
  ));
  return {
    blocked: rows.length > 0,
    blockedByViewer: rows.some((row) => row.blockerId === firstUserId),
    viewerBlocked: rows.some((row) => row.blockerId === secondUserId),
  };
}

export async function conversationInteractionBlocked(conversationId: number, viewerId: number) {
  const [peer] = await db.select({ userId: conversationParticipantsTable.userId }).from(conversationParticipantsTable).where(and(
    eq(conversationParticipantsTable.conversationId, conversationId),
    ne(conversationParticipantsTable.userId, viewerId),
  )).limit(1);
  return peer ? (await interactionBlockState(viewerId, peer.userId)).blocked : false;
}
