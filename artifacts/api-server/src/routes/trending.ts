import { Router } from "express";
import { db } from "@workspace/db";
import { playersTable, playerGameStatsTable, teamsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const trendingRouter = Router();

// GET /stats/trending
trendingRouter.get("/trending", async (req, res) => {
  const players = await db
    .select({
      id: playersTable.id,
      name: playersTable.name,
      sport: playersTable.sport,
      teamName: teamsTable.name,
    })
    .from(playersTable)
    .leftJoin(teamsTable, eq(playersTable.teamId, teamsTable.id))
    .limit(20);

  const trending = [];

  for (const player of players) {
    const stats = await db
      .select()
      .from(playerGameStatsTable)
      .where(eq(playerGameStatsTable.playerId, player.id))
      .orderBy(playerGameStatsTable.gameDate);

    if (stats.length < 2) continue;

    const recent = stats.slice(-3);
    const older = stats.slice(0, -3);

    const avg = (vals: (string | null)[]): number => {
      const nums = vals.map(Number).filter((v) => !isNaN(v));
      return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
    };

    const statTypes =
      player.sport === "MLB"
        ? (["hits", "homeRuns", "rbis"] as const)
        : (["points", "rebounds", "threePointers"] as const);

    for (const statType of statTypes) {
      const recentAvg = avg(recent.map((s) => s[statType as keyof typeof s] as string | null));
      const olderAvg = avg(older.map((s) => s[statType as keyof typeof s] as string | null));

      if (recentAvg === 0) continue;

      const trendPct = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;
      const trend: "up" | "down" | "flat" =
        trendPct > 5 ? "up" : trendPct < -5 ? "down" : "flat";

      trending.push({
        playerId: player.id,
        playerName: player.name,
        sport: player.sport,
        teamName: player.teamName ?? "",
        statType,
        recentAvg: Math.round(recentAvg * 10) / 10,
        trend,
        trendPct: Math.round(trendPct * 10) / 10,
      });
    }
  }

  // Sort by absolute trendPct, take top 12
  trending.sort((a, b) => Math.abs(b.trendPct) - Math.abs(a.trendPct));
  res.json(trending.slice(0, 12));
});
