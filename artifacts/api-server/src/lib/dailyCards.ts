import { db, dailyCardsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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
      cardDate: dailyCardsTable.cardDate,
      createdAt: dailyCardsTable.createdAt,
    })
    .from(dailyCardsTable)
    .innerJoin(usersTable, eq(dailyCardsTable.userId, usersTable.id))
    .where(eq(dailyCardsTable.id, cardId));
  if (!card) return null;
  return {
    ...card,
    avatarUrl: card.avatarUrl ?? null,
    note: card.note ?? null,
    cardDate: card.cardDate.toISOString(),
    createdAt: card.createdAt.toISOString(),
  };
}
