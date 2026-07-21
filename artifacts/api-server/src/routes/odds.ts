/**
 * Odds routes — serve from DB cache populated by daily 5am sync.
 * No live Odds API calls are made here; all data comes from odds_cache.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { oddsCacheTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

export const oddsRouter = Router();

// ── Sport / stat → odds-api key maps (for query translation only) ─
const SPORT_KEY: Record<string, string> = {
  NBA:  "basketball_nba",
  WNBA: "basketball_wnba",
  MLB:  "baseball_mlb",
  NFL:  "americanfootball_nfl",
};

const STAT_MARKET: Record<string, Record<string, string>> = {
  NBA: {
    points:        "player_points",
    rebounds:      "player_rebounds",
    assists:       "player_assists",
    threePointers: "player_threes",
    steals:        "player_steals",
    blocks:        "player_blocks",
    turnovers:     "player_turnovers",
  },
  WNBA: {
    points:        "player_points",
    rebounds:      "player_rebounds",
    assists:       "player_assists",
    threePointers: "player_threes",
    steals:        "player_steals",
    blocks:        "player_blocks",
  },
  MLB: {
    hits:       "batter_hits",
    homeRuns:   "batter_home_runs",
    rbis:       "batter_rbis",
    runs:       "batter_runs_scored",
    strikeouts: "pitcher_strikeouts",
    walks:      "batter_walks",
  },
  NFL: {
    receptionYards: "player_reception_yds",
    passTDs:        "player_pass_tds",
    rushYards:      "player_rush_yds",
    receptions:     "player_receptions",
    passYards:      "player_pass_yds",
  },
};

// GET /odds/props?sport=NBA&stat=points
oddsRouter.get("/props", async (req, res) => {
  const sport  = (req.query.sport as string | undefined)?.toUpperCase() ?? "";
  const stat   = (req.query.stat  as string | undefined) ?? "";

  const sportKey = SPORT_KEY[sport];
  const market   = STAT_MARKET[sport]?.[stat];

  if (!sportKey || !market) {
    return res.status(400).json({ error: `Unsupported sport '${sport}' or stat '${stat}'` });
  }

  const rows = await db
    .select()
    .from(oddsCacheTable)
    .where(and(eq(oddsCacheTable.sport, sportKey), eq(oddsCacheTable.market, market)));

  if (rows.length === 0) {
    return res.json({
      available:  false,
      reason:     "No cached lines — sync runs daily at 5am",
      players:    {},
      games:      0,
      cached_at:  null,
    });
  }

  const players: Record<string, {
    line: number; overOdds: number | null; underOdds: number | null;
    book: string; event: string;
  }> = {};

  const events = new Set<string>();

  for (const row of rows) {
    players[row.playerName] = {
      line:      Number(row.line),
      overOdds:  row.overOdds  ?? null,
      underOdds: row.underOdds ?? null,
      book:      row.book,
      event:     row.eventLabel ?? "",
    };
    if (row.eventLabel) events.add(row.eventLabel);
  }

  return res.json({
    available:  true,
    players,
    games:      events.size,
    market,
    cached_at:  rows[0].fetchedAt.toISOString(),
  });
});

// GET /odds/events?sport=NBA — just returns whether events are cached
oddsRouter.get("/events", async (req, res) => {
  const sport    = (req.query.sport as string | undefined)?.toUpperCase() ?? "";
  const sportKey = SPORT_KEY[sport];
  if (!sportKey) return res.status(400).json({ error: "Invalid sport" });

  // Probe for any row in this sport
  const rows = await db
    .select({ event: oddsCacheTable.eventLabel })
    .from(oddsCacheTable)
    .where(eq(oddsCacheTable.sport, sportKey))
    .limit(20);

  const unique = [...new Set(rows.map(r => r.event).filter(Boolean))];
  return res.json({ available: unique.length > 0, events: unique });
});
