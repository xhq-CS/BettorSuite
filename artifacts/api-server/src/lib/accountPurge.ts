import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

export async function purgeAccountData(userId: number, deleteLogin = false) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`delete from password_reset_tokens where user_id = ${userId}`);
    await tx.execute(sql`delete from user_blocks where blocker_id = ${userId} or blocked_id = ${userId}`);
    await tx.execute(sql`update reports set reporter_id = null where reporter_id = ${userId}`);
    await tx.execute(sql`update reports set reported_user_id = null where reported_user_id = ${userId}`);
    await tx.execute(sql`update reports set reviewed_by = null where reviewed_by = ${userId}`);
    await tx.execute(sql`delete from post_likes where user_id = ${userId} or post_id in (select id from posts where user_id = ${userId})`);
    await tx.execute(sql`delete from posts where user_id = ${userId}`);
    await tx.execute(sql`delete from group_messages where sender_id = ${userId} or group_id in (select id from groups where creator_id = ${userId})`);
    await tx.execute(sql`delete from group_invites where user_id = ${userId} or invited_by = ${userId} or group_id in (select id from groups where creator_id = ${userId})`);
    await tx.execute(sql`delete from group_members where user_id = ${userId} or group_id in (select id from groups where creator_id = ${userId})`);
    await tx.execute(sql`delete from groups where creator_id = ${userId}`);
    await tx.execute(sql`delete from messages where sender_id = ${userId} or conversation_id in (select conversation_id from conversation_participants where user_id = ${userId})`);
    await tx.execute(sql`delete from conversation_participants where conversation_id in (select conversation_id from conversation_participants where user_id = ${userId})`);
    await tx.execute(sql`delete from conversations where not exists (select 1 from conversation_participants where conversation_id = conversations.id)`);
    await tx.execute(sql`delete from daily_cards where user_id = ${userId}`);
    await tx.execute(sql`delete from public_bet_revisions where user_id = ${userId}`);
    await tx.execute(sql`delete from tracker_wallet_transactions where user_id = ${userId}`);
    await tx.execute(sql`delete from bets where user_id = ${userId}`);
    await tx.execute(sql`delete from simulator_bets where user_id = ${userId}`);
    await tx.execute(sql`delete from simulator_wallets where user_id = ${userId}`);
    await tx.execute(sql`delete from user_nicknames where owner_id = ${userId} or target_user_id = ${userId}`);
    await tx.execute(sql`delete from follows where follower_id = ${userId} or following_id = ${userId}`);

    if (deleteLogin) {
      await tx.execute(sql`delete from sessions where user_id = ${userId}`);
      await tx.delete(usersTable).where(eq(usersTable.id, userId));
    } else {
      await tx
        .update(usersTable)
        .set({
          trackerBankroll: "0",
          trackerBreakEvenEnabled: false,
          trackerBreakEvenBalance: null,
          trackerBreakEvenAdjustment: "0",
          trackerBreakEvenSetAt: null,
          trackerWageredResetAt: null,
          warRoomMuted: false,
          warRoomMutedAt: null,
          warRoomMutedBy: null,
        })
        .where(eq(usersTable.id, userId));
    }
  });
}
