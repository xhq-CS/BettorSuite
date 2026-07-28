import { betsTable, db, dailyCardsTable, usersTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { trackerBetSnapshot } from "./betSnapshots";

export async function getDailyCard(cardId: number | null | undefined) {
  if (!cardId) return null;
  const [card] = await db
    .select({
      id: dailyCardsTable.id,
      userId: dailyCardsTable.userId,
      username: usersTable.username,
      avatarUrl: usersTable.avatarUrl,
      title: dailyCardsTable.title,
      note: dailyCardsTable.note,
      leagues: dailyCardsTable.leagues,
      picks: dailyCardsTable.picks,
      sourceBetIds: dailyCardsTable.sourceBetIds,
      cardDate: dailyCardsTable.cardDate,
      createdAt: dailyCardsTable.createdAt,
    })
    .from(dailyCardsTable)
    .innerJoin(usersTable, eq(dailyCardsTable.userId, usersTable.id))
    .where(eq(dailyCardsTable.id, cardId));
  if (!card) return null;
  let picks = card.picks;
  const sourceBetIds = card.sourceBetIds.length
    ? card.sourceBetIds
    : card.picks.filter((pick) => pick.source === "tracker").map((pick) => pick.originalBetId);
  if (sourceBetIds.length) {
    const rows = await db.select().from(betsTable).where(inArray(betsTable.id, sourceBetIds));
    const byId = new Map(rows.map((bet) => [bet.id, bet]));
    picks = card.picks.map((snapshot) => {
      const current = snapshot.source === "tracker" ? byId.get(snapshot.originalBetId) : undefined;
      return current ? trackerBetSnapshot(current) : snapshot;
    });
  }
  return {
    ...card,
    picks,
    avatarUrl: card.avatarUrl ?? null,
    note: card.note ?? null,
    cardDate: card.cardDate.toISOString(),
    createdAt: card.createdAt.toISOString(),
  };
}
