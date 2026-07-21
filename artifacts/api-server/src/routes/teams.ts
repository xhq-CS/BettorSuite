import { Router } from "express";
import { db } from "@workspace/db";
import { teamsTable, teamGameStatsTable } from "@workspace/db";
import { eq, and, gte, desc } from "drizzle-orm";
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

// GET /teams/stat-rankings?sport=NBA&scope=last5|last10|all&venue=home|away|all
// Aggregated team performance table for the Browse → Stats page.
// NOTE: must stay registered BEFORE /:id
teamsRouter.get("/stat-rankings", async (req, res) => {
  const sport = (req.query.sport as string | undefined) ?? "";
  const scope = (req.query.scope as string | undefined) ?? "all";     // last5 | last10 | all
  const venue = (req.query.venue as string | undefined) ?? "all";     // home | away | all

  if (!sport) return res.status(400).json({ error: "sport is required" });

  const teams = await db
    .select()
    .from(teamsTable)
    .where(eq(teamsTable.sport, sport));

  const results = [];

  for (const team of teams) {
    let games = await db
      .select()
      .from(teamGameStatsTable)
      .where(eq(teamGameStatsTable.teamId, team.id))
      .orderBy(desc(teamGameStatsTable.gameDate));

    if (venue === "home") games = games.filter(g => g.isHome);
    if (venue === "away") games = games.filter(g => !g.isHome);
    if (scope === "last5")  games = games.slice(0, 5);
    if (scope === "last10") games = games.slice(0, 10);

    if (games.length === 0) {
      results.push({
        teamId: team.id, teamName: team.name, city: team.city,
        abbreviation: team.abbreviation, logoUrl: team.logoUrl,
        gamesPlayed: 0, wins: 0, losses: 0, winPct: 0,
        avgScore: 0, avgOppScore: 0, avgMargin: 0,
        avgTotalPoints: null, avgTotalRebounds: null, avgTotalAssists: null,
        avgThreePointersMade: null, avgTotalHits: null, avgTotalRuns: null,
        avgTotalHomeRuns: null,
      });
      continue;
    }

    const n = games.length;
    const avgOf = (fn: (g: typeof games[number]) => number | null): number | null => {
      const vals = games.map(fn).filter((v): v is number => v != null && !isNaN(v));
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };

    const wins = games.filter(g => g.won).length;

    results.push({
      teamId:       team.id,
      teamName:     team.name,
      city:         team.city,
      abbreviation: team.abbreviation,
      logoUrl:      team.logoUrl,
      gamesPlayed:  n,
      wins,
      losses:       n - wins,
      winPct:       n ? wins / n : 0,
      avgScore:     avgOf(g => g.score) ?? 0,
      avgOppScore:  avgOf(g => g.opponentScore) ?? 0,
      avgMargin:    (avgOf(g => g.score) ?? 0) - (avgOf(g => g.opponentScore) ?? 0),
      avgTotalPoints:       avgOf(g => g.totalPoints       != null ? Number(g.totalPoints)       : null),
      avgTotalRebounds:     avgOf(g => g.totalRebounds     != null ? Number(g.totalRebounds)     : null),
      avgTotalAssists:      avgOf(g => g.totalAssists      != null ? Number(g.totalAssists)      : null),
      avgThreePointersMade: avgOf(g => g.threePointersMade != null ? Number(g.threePointersMade) : null),
      avgTotalHits:         avgOf(g => g.totalHits         != null ? Number(g.totalHits)         : null),
      avgTotalRuns:         avgOf(g => g.totalRuns         != null ? Number(g.totalRuns)         : null),
      avgTotalHomeRuns:     avgOf(g => g.totalHomeRuns     != null ? Number(g.totalHomeRuns)     : null),
    });
  }

  results.sort((a, b) => b.winPct - a.winPct || b.avgMargin - a.avgMargin);
  return res.json(results);
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
