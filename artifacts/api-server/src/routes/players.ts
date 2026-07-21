import { Router } from "express";
import { db } from "@workspace/db";
import {
  playersTable,
  teamsTable,
  playerGameStatsTable,
} from "@workspace/db";
import { eq, and, gte, ilike, inArray } from "drizzle-orm";
import {
  GetPlayerStatsParams,
  GetPlayerPropSummaryParams,
  GetPlayerParams,
  ListPlayersQueryParams,
} from "@workspace/api-zod";

export const playersRouter = Router();

// ── helpers ──────────────────────────────────────────────────────────────────
function numAvg(vals: (number | null)[]): number {
  const v = vals.filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}

const VALID_STATS: Record<string, string[]> = {
  NBA:  ["points","rebounds","assists","threePointers","steals","blocks","turnovers"],
  WNBA: ["points","rebounds","assists","threePointers","steals","blocks","turnovers"],
  MLB:  ["hits","homeRuns","rbis","runs","strikeouts","walks"],
};

// GET /players/prop-rankings?sport=NBA&stat=points
// MUST be registered before /:id to avoid route conflict
playersRouter.get("/prop-rankings", async (req, res) => {
  const sport = (req.query.sport as string | undefined)?.toUpperCase();
  const stat  = req.query.stat as string | undefined;

  if (!sport || !stat) {
    return res.status(400).json({ error: "sport and stat query params are required" });
  }

  const validStats = VALID_STATS[sport];
  if (!validStats) {
    return res.status(400).json({ error: `Unknown sport. Use: ${Object.keys(VALID_STATS).join(", ")}` });
  }
  if (!validStats.includes(stat)) {
    return res.status(400).json({ error: `Invalid stat for ${sport}. Use: ${validStats.join(", ")}` });
  }

  // 1. All players for this sport
  const players = await db
    .select({
      id:       playersTable.id,
      name:     playersTable.name,
      sport:    playersTable.sport,
      position: playersTable.position,
      teamId:   playersTable.teamId,
      teamName: teamsTable.name,
    })
    .from(playersTable)
    .leftJoin(teamsTable, eq(playersTable.teamId, teamsTable.id))
    .where(eq(playersTable.sport, sport));

  if (!players.length) return res.json([]);

  // 2. Season stats for all those players (last 365 days)
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 365);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  const playerIds = players.map(p => p.id);

  const allStats = await db
    .select()
    .from(playerGameStatsTable)
    .where(
      and(
        inArray(playerGameStatsTable.playerId, playerIds),
        gte(playerGameStatsTable.gameDate, cutoffStr)
      )
    )
    .orderBy(playerGameStatsTable.gameDate);

  // 3. Group by player
  const statsByPlayer = new Map<number, number[]>();
  for (const s of allStats) {
    const raw = (s as any)[stat];
    const val = raw !== null && raw !== undefined ? Number(raw) : null;
    if (val === null) continue;
    if (!statsByPlayer.has(s.playerId)) statsByPlayer.set(s.playerId, []);
    statsByPlayer.get(s.playerId)!.push(val);
  }

  // 4. Build ranking rows
  const rows = players
    .map(p => {
      const vals    = statsByPlayer.get(p.id) ?? [];
      const last5   = vals.slice(-5);
      const last10  = vals.slice(-10);
      const last20  = vals.slice(-20);

      return {
        playerId:    p.id,
        playerName:  p.name,
        teamName:    p.teamName ?? "",
        position:    p.position ?? "",
        gamesPlayed: vals.length,
        last5Avg:    parseFloat(numAvg(last5).toFixed(2)),
        last10Avg:   parseFloat(numAvg(last10).toFixed(2)),
        last20Avg:   parseFloat(numAvg(last20).toFixed(2)),
        seasonAvg:   parseFloat(numAvg(vals).toFixed(2)),
        high:        vals.length ? Math.max(...vals) : 0,
        low:         vals.length ? Math.min(...vals) : 0,
      };
    })
    .filter(r => r.gamesPlayed > 0)
    .sort((a, b) => b.seasonAvg - a.seasonAvg);

  return res.json(rows);
});

// GET /players
playersRouter.get("/", async (req, res) => {
  const query = ListPlayersQueryParams.parse(req.query);
  const conditions = [];

  if (query.sport)   conditions.push(eq(playersTable.sport, query.sport));
  if (query.teamId)  conditions.push(eq(playersTable.teamId, Number(query.teamId)));
  if (query.search)  conditions.push(ilike(playersTable.name, `%${query.search}%`));

  const rows = await db
    .select({
      id:       playersTable.id,
      name:     playersTable.name,
      sport:    playersTable.sport,
      position: playersTable.position,
      teamId:   playersTable.teamId,
      teamName: teamsTable.name,
      number:   playersTable.number,
      avatarUrl: playersTable.avatarUrl,
    })
    .from(playersTable)
    .leftJoin(teamsTable, eq(playersTable.teamId, teamsTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .limit(100);

  res.json(rows.map(r => ({ ...r, teamName: r.teamName ?? "" })));
});

// GET /players/:id
playersRouter.get("/:id", async (req, res) => {
  const { id } = GetPlayerParams.parse({ id: Number(req.params.id) });
  const [player] = await db
    .select({
      id:       playersTable.id,
      name:     playersTable.name,
      sport:    playersTable.sport,
      position: playersTable.position,
      teamId:   playersTable.teamId,
      teamName: teamsTable.name,
      number:   playersTable.number,
      avatarUrl: playersTable.avatarUrl,
    })
    .from(playersTable)
    .leftJoin(teamsTable, eq(playersTable.teamId, teamsTable.id))
    .where(eq(playersTable.id, id));

  if (!player) return void res.status(404).json({ error: "Player not found" });
  res.json({ ...player, teamName: player.teamName ?? "" });
});

// GET /players/:id/stats/:period
playersRouter.get("/:id/stats/:period", async (req, res) => {
  const { id, period } = GetPlayerStatsParams.parse({
    id:     Number(req.params.id),
    period: req.params.period,
  });

  const periodDays: Record<string, number> = {
    week: 7, biweek: 14, month: 30, season: 365,
  };
  const days      = periodDays[period] ?? 30;
  const cutoff    = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  const stats = await db
    .select()
    .from(playerGameStatsTable)
    .where(and(
      eq(playerGameStatsTable.playerId, id),
      gte(playerGameStatsTable.gameDate, cutoffStr)
    ))
    .orderBy(playerGameStatsTable.gameDate);   // oldest → newest; frontend reverses for game log

  res.json(stats.map(s => ({
    id:             s.id,
    playerId:       s.playerId,
    gameDate:       s.gameDate,
    opponent:       s.opponent,
    points:         s.points         !== null ? Number(s.points)         : null,
    rebounds:       s.rebounds       !== null ? Number(s.rebounds)       : null,
    assists:        s.assists        !== null ? Number(s.assists)        : null,
    steals:         s.steals         !== null ? Number(s.steals)         : null,
    blocks:         s.blocks         !== null ? Number(s.blocks)         : null,
    threePointers:  s.threePointers  !== null ? Number(s.threePointers)  : null,
    turnovers:      s.turnovers      !== null ? Number(s.turnovers)      : null,
    minutesPlayed:  s.minutesPlayed  !== null ? Number(s.minutesPlayed)  : null,
    hits:           s.hits           !== null ? Number(s.hits)           : null,
    homeRuns:       s.homeRuns       !== null ? Number(s.homeRuns)       : null,
    rbis:           s.rbis           !== null ? Number(s.rbis)           : null,
    runs:           s.runs           !== null ? Number(s.runs)           : null,
    strikeouts:     s.strikeouts     !== null ? Number(s.strikeouts)     : null,
    walks:          s.walks          !== null ? Number(s.walks)          : null,
    inningsPitched: s.inningsPitched !== null ? Number(s.inningsPitched) : null,
    earnedRuns:     s.earnedRuns     !== null ? Number(s.earnedRuns)     : null,
  })));
});

// GET /players/:id/prop-summary
playersRouter.get("/:id/prop-summary", async (req, res) => {
  const { id } = GetPlayerPropSummaryParams.parse({ id: Number(req.params.id) });

  const [player] = await db
    .select({ name: playersTable.name, sport: playersTable.sport })
    .from(playersTable)
    .where(eq(playersTable.id, id));

  if (!player) return void res.status(404).json({ error: "Player not found" });

  const stats = await db
    .select()
    .from(playerGameStatsTable)
    .where(eq(playerGameStatsTable.playerId, id))
    .orderBy(playerGameStatsTable.gameDate);

  const avg = (vals: (number | null)[]) => {
    const valid = vals.filter((v): v is number => v !== null);
    return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
  };

  const ns = stats.map(s => ({
    points:        s.points        !== null ? Number(s.points)        : null,
    rebounds:      s.rebounds      !== null ? Number(s.rebounds)      : null,
    assists:       s.assists       !== null ? Number(s.assists)       : null,
    steals:        s.steals        !== null ? Number(s.steals)        : null,
    threePointers: s.threePointers !== null ? Number(s.threePointers) : null,
    hits:          s.hits          !== null ? Number(s.hits)          : null,
    homeRuns:      s.homeRuns      !== null ? Number(s.homeRuns)      : null,
    rbis:          s.rbis          !== null ? Number(s.rbis)          : null,
  }));

  return res.json({
    playerId:          id,
    playerName:        player.name,
    sport:             player.sport,
    gamesPlayed:       stats.length,
    avgPoints:         avg(ns.map(s => s.points)),
    avgRebounds:       avg(ns.map(s => s.rebounds)),
    avgAssists:        avg(ns.map(s => s.assists)),
    avgSteals:         avg(ns.map(s => s.steals)),
    avgThreePointers:  avg(ns.map(s => s.threePointers)),
    avgHits:           avg(ns.map(s => s.hits)),
    avgHomeRuns:       avg(ns.map(s => s.homeRuns)),
    avgRbis:           avg(ns.map(s => s.rbis)),
  });
});
