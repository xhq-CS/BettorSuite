import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, betsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const leaderboardRouter = Router();

// GET /leaderboard
leaderboardRouter.get("/", async (req, res) => {
  const users = await db.select().from(usersTable).limit(20);

  const entries = await Promise.all(
    users.map(async (u) => {
      const bets = await db.select().from(betsTable).where(eq(betsTable.userId, u.id));
      const settled = bets.filter((b) => ["won", "lost", "push"].includes(b.status));
      const wins = settled.filter((b) => b.status === "won").length;
      const winRate = settled.length > 0 ? wins / settled.length : 0;
      const totalWagered = bets.reduce((sum, b) => sum + Number(b.wager), 0);
      const totalReturned = bets
        .filter((b) => b.actualPayout !== null)
        .reduce((sum, b) => sum + Number(b.actualPayout), 0);
      const totalProfit = totalReturned - totalWagered;
      const roi = totalWagered > 0 ? totalProfit / totalWagered : 0;
      return {
        userId: u.id,
        username: u.username,
        avatarUrl: u.avatarUrl ?? null,
        totalBets: bets.length,
        wins,
        winRate,
        totalProfit,
        roi,
        rank: 0,
      };
    })
  );

  entries.sort((a, b) => b.winRate - a.winRate);
  entries.forEach((e, i) => { e.rank = i + 1; });

  res.json(entries);
});
