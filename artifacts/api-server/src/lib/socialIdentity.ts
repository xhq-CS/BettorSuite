import { and, eq, inArray } from "drizzle-orm";
import { db, userNicknamesTable } from "@workspace/db";

export async function privateNicknameMap(ownerId: number, targetIds: number[]) {
  const uniqueIds = [...new Set(targetIds.filter((id) => id !== ownerId))];
  if (!uniqueIds.length) return new Map<number, string>();

  const rows = await db
    .select({
      targetUserId: userNicknamesTable.targetUserId,
      nickname: userNicknamesTable.nickname,
    })
    .from(userNicknamesTable)
    .where(
      and(
        eq(userNicknamesTable.ownerId, ownerId),
        inArray(userNicknamesTable.targetUserId, uniqueIds),
      ),
    );

  return new Map(rows.map((row) => [row.targetUserId, row.nickname]));
}
