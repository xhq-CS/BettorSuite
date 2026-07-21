/**
 * Odds routes — serve from DB cache populated by daily 5am sync.
 * No live Odds API calls are made here; all data comes from odds_cache.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { oddsCacheTable } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";

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

// GET /odds/props?sport=NBA&stat=points&lineType=main|alternate
oddsRouter.get("/props", async (req, res) => {
  const sport    = (req.query.sport as string | undefined)?.toUpperCase() ?? "";
  const stat     = (req.query.stat  as string | undefined) ?? "";
  const lineType = (req.query.lineType as string | undefined) === "alternate" ? "alternate" : "main";

  const sportKey   = SPORT_KEY[sport];
  const mainMarket = STAT_MARKET[sport]?.[stat];

  if (!sportKey || !mainMarket) {
    return res.status(400).json({ error: `Unsupported sport '${sport}' or stat '${stat}'` });
  }

  const market = lineType === "alternate" ? `${mainMarket}_alternate` : mainMarket;

  const rows = await db
    .select()
    .from(oddsCacheTable)
    .where(and(eq(oddsCacheTable.sport, sportKey), eq(oddsCacheTable.market, market)));

  if (rows.length === 0) {
    return res.json({
      available:  false,
      reason:     lineType === "alternate"
        ? "No alternate lines cached for this market"
        : "No cached lines — sync runs daily at 5am",
      players:    {},
      games:      0,
      lineType,
      cached_at:  null,
    });
  }

  const events = new Set<string>();

  if (lineType === "alternate") {
    // Multiple lines per player → array per player, sorted by line
    const players: Record<string, {
      line: number; overOdds: number | null; underOdds: number | null;
      book: string; event: string;
    }[]> = {};
    for (const row of rows) {
      (players[row.playerName] ??= []).push({
        line:      Number(row.line),
        overOdds:  row.overOdds  ?? null,
        underOdds: row.underOdds ?? null,
        book:      row.book,
        event:     row.eventLabel ?? "",
      });
      if (row.eventLabel) events.add(row.eventLabel);
    }
    for (const k of Object.keys(players)) players[k].sort((a, b) => a.line - b.line);
    return res.json({
      available: true, players, games: events.size, market, lineType,
      cached_at: rows[0].fetchedAt.toISOString(),
    });
  }

  const players: Record<string, {
    line: number; overOdds: number | null; underOdds: number | null;
    book: string; event: string;
  }> = {};

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
    lineType,
    cached_at:  rows[0].fetchedAt.toISOString(),
  });
});

// GET /odds/team-lines?sport=NBA
// Returns per-event team markets: moneyline, spread, total.
oddsRouter.get("/team-lines", async (req, res) => {
  const sport    = (req.query.sport as string | undefined)?.toUpperCase() ?? "";
  const sportKey = SPORT_KEY[sport];
  if (!sportKey) return res.status(400).json({ error: "Invalid sport" });

  const teamMarkets = ["team_h2h", "team_spreads", "team_totals"];
  const rows = await db
    .select()
    .from(oddsCacheTable)
    .where(and(
      eq(oddsCacheTable.sport, sportKey),
      inArray(oddsCacheTable.market, teamMarkets),
    ));

  if (rows.length === 0) {
    return res.json({ available: false, events: [], cached_at: null });
  }

  // Group by event
  interface TeamSide { team: string; moneyline: number | null; spread: number | null; spreadOdds: number | null }
  const events = new Map<string, {
    event: string;
    sides: Map<string, TeamSide>;
    total: { line: number; overOdds: number | null; underOdds: number | null } | null;
    book: string;
  }>();

  for (const row of rows) {
    const label = row.eventLabel ?? "";
    if (!events.has(label)) {
      events.set(label, { event: label, sides: new Map(), total: null, book: row.book });
    }
    const ev = events.get(label)!;

    if (row.market === "team_h2h") {
      const side = ev.sides.get(row.playerName) ?? { team: row.playerName, moneyline: null, spread: null, spreadOdds: null };
      side.moneyline = row.overOdds ?? null;
      ev.sides.set(row.playerName, side);
    } else if (row.market === "team_spreads") {
      const side = ev.sides.get(row.playerName) ?? { team: row.playerName, moneyline: null, spread: null, spreadOdds: null };
      side.spread     = Number(row.line);
      side.spreadOdds = row.overOdds ?? null;
      ev.sides.set(row.playerName, side);
    } else if (row.market === "team_totals") {
      ev.total = {
        line:      Number(row.line),
        overOdds:  row.overOdds  ?? null,
        underOdds: row.underOdds ?? null,
      };
    }
  }

  return res.json({
    available: true,
    events: [...events.values()].map(e => ({
      event: e.event,
      book:  e.book,
      teams: [...e.sides.values()],
      total: e.total,
    })),
    cached_at: rows[0].fetchedAt.toISOString(),
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
