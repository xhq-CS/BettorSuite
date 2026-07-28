import { Router } from "express";
import { db, usersTable, betsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { localDateKey } from "../lib/localDates";

export const leaderboardRouter = Router();

leaderboardRouter.get("/", async (_req, res) => {
  const users = await db.select().from(usersTable).limit(100);
  const entries = (
    await Promise.all(
      users.map(async (user) => {
        const bets = await db
          .select()
          .from(betsTable)
          .where(eq(betsTable.userId, user.id));
        const settled = bets.filter((bet) =>
          ["won", "lost", "push"].includes(bet.status),
        );
        if (!settled.length) return null;
        const wins = settled.filter((bet) => bet.status === "won").length;
        const totalWagered = settled.reduce(
          (sum, bet) => sum + Number(bet.wager),
          0,
        );
        const resultProfit = (bet: typeof betsTable.$inferSelect) =>
          bet.status === "won"
            ? Number(bet.actualPayout ?? bet.potentialPayout) -
              Number(bet.wager)
            : bet.status === "lost"
              ? -Number(bet.wager)
              : 0;
        const totalProfit = settled.reduce(
          (sum, bet) => sum + resultProfit(bet),
          0,
        );
        const profitByDay = new Map<string, number>();
        settled.forEach((bet) => {
          const day = localDateKey(bet.betDate);
          profitByDay.set(day, (profitByDay.get(day) ?? 0) + resultProfit(bet));
        });
        const weekStart = new Date(`${localDateKey(new Date())}T12:00:00`);
        const daysSinceMonday = (weekStart.getDay() + 6) % 7;
        weekStart.setDate(weekStart.getDate() - daysSinceMonday);
        const streak = Array.from({ length: 7 }, (_, index) => {
          const day = new Date(weekStart);
          day.setDate(weekStart.getDate() + index);
          const date = localDateKey(day);
          const profit =
            Math.round(((profitByDay.get(date) ?? 0) + Number.EPSILON) * 100) /
            100;
          return { date, profit, profitable: profit > 0 };
        });
        return {
          userId: user.id,
          username: user.username,
          avatarUrl: user.avatarUrl ?? null,
          totalBets: settled.length,
          wins,
          winRate: wins / settled.length,
          totalProfit,
          roi: totalWagered ? totalProfit / totalWagered : 0,
          streak,
          rank: 0,
        };
      }),
    )
  ).filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  entries.sort(
    (a, b) =>
      b.totalProfit - a.totalProfit || b.roi - a.roi || b.winRate - a.winRate,
  );
  entries.forEach((entry, index) => {
    entry.rank = index + 1;
  });
  return res.json(entries);
});
