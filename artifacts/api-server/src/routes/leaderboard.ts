import { Router } from "express";
import { db, usersTable, betsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const leaderboardRouter = Router();

leaderboardRouter.get("/", async (_req, res) => {
  const users = await db.select().from(usersTable).limit(100);
  const entries = (await Promise.all(users.map(async (user) => {
    const bets = await db.select().from(betsTable).where(eq(betsTable.userId, user.id));
    const settled = bets.filter((bet) => ["won", "lost", "push"].includes(bet.status));
    if (!settled.length) return null;
    const wins = settled.filter((bet) => bet.status === "won").length;
    const totalWagered = bets.reduce((sum, bet) => sum + Number(bet.wager), 0);
    const totalReturned = bets.reduce((sum, bet) => sum + Number(bet.actualPayout ?? 0), 0);
    const totalProfit = totalReturned - totalWagered;
    return { userId:user.id, username:user.username, avatarUrl:user.avatarUrl ?? null, totalBets:bets.length, wins, winRate:wins/settled.length, totalProfit, roi:totalWagered ? totalProfit/totalWagered : 0, rank:0 };
  }))).filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  entries.sort((a,b) => b.roi - a.roi || b.winRate - a.winRate);
  entries.forEach((entry,index) => { entry.rank=index+1; });
  return res.json(entries);
});
