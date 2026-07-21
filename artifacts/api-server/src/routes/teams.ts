import { Router } from "express";
import { db } from "@workspace/db";
import { teamsTable, teamGameStatsTable } from "@workspace/db";
import { eq, and, gte } from "drizzle-orm";
import {
  ListTeamsQueryParams,
  GetTeamParams,
  GetTeamStatsParams,
} from "@workspace/api-zod";

export const teamsRouter = Router();

// GET /teams
teamsRouter.get("/", async (req, res) => {
  const query = ListTeamsQueryParams.parse(req.query);
  const rows = await db
    .select()
    .from(teamsTable)
    .where(query.sport ? eq(teamsTable.sport, query.sport) : undefined);
  res.json(rows);
});

// GET /teams/:id
teamsRouter.get("/:id", async (req, res) => {
  const { id } = GetTeamParams.parse({ id: Number(req.params.id) });
  const [team] = await db
    .select()
    .from(teamsTable)
    .where(eq(teamsTable.id, id));
  if (!team) return void res.status(404).json({ error: "Team not found" });
  return res.json(team);
});

// GET /teams/:id/stats/:period
teamsRouter.get("/:id/stats/:period", async (req, res) => {
  const { id, period } = GetTeamStatsParams.parse({
    id: Number(req.params.id),
    period: req.params.period,
  });

  const periodDays: Record<string, number> = {
    week: 7,
    biweek: 14,
    month: 30,
    season: 365,
  };
  const days = periodDays[period] ?? 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  const stats = await db
    .select()
    .from(teamGameStatsTable)
    .where(
      and(
        eq(teamGameStatsTable.teamId, id),
        gte(teamGameStatsTable.gameDate, cutoffStr)
      )
    )
    .orderBy(teamGameStatsTable.gameDate);

  return res.json(
    stats.map((s) => ({
      id: s.id,
      teamId: s.teamId,
      gameDate: s.gameDate,
      opponent: s.opponent,
      isHome: s.isHome,
      score: s.score,
      opponentScore: s.opponentScore,
      won: s.won,
      totalPoints: s.totalPoints !== null ? Number(s.totalPoints) : null,
      totalRebounds: s.totalRebounds !== null ? Number(s.totalRebounds) : null,
      totalAssists: s.totalAssists !== null ? Number(s.totalAssists) : null,
      threePointersMade: s.threePointersMade !== null ? Number(s.threePointersMade) : null,
      totalHits: s.totalHits !== null ? Number(s.totalHits) : null,
      totalRuns: s.totalRuns !== null ? Number(s.totalRuns) : null,
      totalHomeRuns: s.totalHomeRuns !== null ? Number(s.totalHomeRuns) : null,
      errors: s.errors !== null ? Number(s.errors) : null,
    }))
  );
});
