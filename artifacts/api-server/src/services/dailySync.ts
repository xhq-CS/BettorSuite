/**
 * Daily sync service
 *
 * Runs at 5:00 AM (server local time) each day.
 * - Fetches player prop lines from The Odds API (player props via events endpoint)
 * - Fetches season stats from API-Sports
 * - Upserts both into DB cache tables
 * - Logs each run to sync_log
 *
 * All API routes subsequently read from these DB tables rather than hitting
 * the external APIs on every request, so we never blow through free-tier quotas.
 */

import { db } from "@workspace/db";
import {
  oddsCacheTable,
  playerStatsCacheTable,
  syncLogTable,
  playersTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const ODDS_KEY        = process.env.ODDS_API_KEY     ?? "";
const SPORTS_KEY      = process.env.API_SPORTS_KEY   ?? "";
const ODDS_BASE       = "https://api.the-odds-api.com/v4";
const PREF_BOOKS      = ["draftkings", "fanduel", "betmgm", "williamhill_us", "bovada"];

// ── Sport definitions ──────────────────────────────────────────────
interface SportDef {
  ourKey:    string;           // "NBA"
  oddsKey:   string;           // "basketball_nba"
  sportsHost: string;          // api-sports.io host
  leagueId?: number;           // for non-default leagues (WNBA)
  season:    number;
  markets:   string[];         // odds-api market keys (main lines)
  altMarkets?: string[];       // odds-api alternate-line market keys
}

const SPORTS: SportDef[] = [
  {
    ourKey:    "NBA",
    oddsKey:   "basketball_nba",
    sportsHost:"https://v2.nba.api-sports.io",
    season:    2024,
    markets:   ["player_points","player_rebounds","player_assists","player_threes","player_steals","player_blocks","player_turnovers"],
    altMarkets:["player_points_alternate","player_rebounds_alternate","player_assists_alternate","player_threes_alternate"],
  },
  {
    ourKey:    "WNBA",
    oddsKey:   "basketball_wnba",
    sportsHost:"https://v1.basketball.api-sports.io",
    leagueId:  17,
    season:    2025,
    markets:   ["player_points","player_rebounds","player_assists","player_threes","player_steals","player_blocks"],
    altMarkets:["player_points_alternate","player_rebounds_alternate","player_assists_alternate"],
  },
  {
    ourKey:    "MLB",
    oddsKey:   "baseball_mlb",
    sportsHost:"https://v1.baseball.api-sports.io",
    season:    2025,
    markets:   ["batter_hits","batter_home_runs","batter_rbis","batter_runs_scored","pitcher_strikeouts","batter_walks"],
    altMarkets:["batter_hits_alternate","batter_home_runs_alternate","pitcher_strikeouts_alternate"],
  },
  {
    ourKey:    "NFL",
    oddsKey:   "americanfootball_nfl",
    sportsHost:"https://v1.american-football.api-sports.io",
    season:    2024,
    markets:   ["player_reception_yds","player_pass_tds","player_rush_yds","player_receptions","player_pass_yds"],
    altMarkets:["player_reception_yds_alternate","player_rush_yds_alternate","player_receptions_alternate"],
  },
];

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

async function oddsGet(path: string): Promise<any> {
  const sep = path.includes("?") ? "&" : "?";
  const url  = `${ODDS_BASE}${path}${sep}apiKey=${ODDS_KEY}`;
  const r    = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`Odds API ${r.status} ${await r.text().catch(() => "")}`);
  return r.json();
}

async function sportsGet(host: string, path: string): Promise<any> {
  const url = `${host}${path}`;
  const r   = await fetch(url, {
    headers: { "x-apisports-key": SPORTS_KEY },
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw new Error(`API-Sports ${r.status}`);
  return r.json();
}

// ─────────────────────────────────────────────────────────────────
// Odds sync
// ─────────────────────────────────────────────────────────────────

async function syncOdds(log: (msg: string) => void): Promise<number> {
  if (!ODDS_KEY) { log("ODDS_API_KEY not set — skipping odds sync"); return 0; }

  let total = 0;

  for (const sport of SPORTS) {
    log(`[odds] Fetching events for ${sport.ourKey}…`);

    let events: any[];
    try {
      events = await oddsGet(`/sports/${sport.oddsKey}/events?dateFormat=iso`);
    } catch (e: any) {
      log(`[odds] ${sport.ourKey} events error: ${e.message}`);
      continue;
    }

    if (!events?.length) {
      log(`[odds] ${sport.ourKey}: no events today`);
      continue;
    }

    log(`[odds] ${sport.ourKey}: ${events.length} event(s), fetching lines…`);

    // Collected rows keyed by `${market}|${player}|${line}` so alternate
    // markets can hold multiple lines per player.
    const collected = new Map<string, {
      market: string; playerName: string; line: number;
      overOdds: number | null; underOdds: number | null;
      book: string; event: string;
    }>();

    const put = (market: string, playerName: string, line: number,
                 side: "Over" | "Under" | null, price: number | null,
                 book: string, event: string) => {
      // Alternate markets keep one row per line (the whole ladder).
      // Main/team markets keep ONE row per participant, deterministically
      // taken from the most-preferred book (so books disagreeing on the
      // line can't produce duplicate rows).
      const isAlt = market.endsWith("_alternate");
      const key = isAlt ? `${market}|${playerName}|${line}` : `${market}|${playerName}`;
      const existing = collected.get(key);
      if (!existing) {
        collected.set(key, {
          market, playerName, line,
          overOdds:  side === "Over"  || side === null ? price : null,
          underOdds: side === "Under" ? price : null,
          book, event,
        });
        return;
      }
      const rank         = PREF_BOOKS.indexOf(book);
      const existingRank = PREF_BOOKS.indexOf(existing.book);
      const sameBook   = book === existing.book;
      const betterBook = rank !== -1 && (existingRank === -1 || rank < existingRank);
      if (betterBook && !isAlt) {
        // Preferred book wins the whole row (line + odds) for main markets
        existing.book = book; existing.event = event; existing.line = line;
        existing.overOdds = null; existing.underOdds = null;
      }
      if (sameBook || betterBook || (existing.overOdds == null && existing.underOdds == null)) {
        if (side === "Over" || side === null) { if (existing.overOdds  == null || betterBook) existing.overOdds  = price; }
        if (side === "Under")                 { if (existing.underOdds == null || betterBook) existing.underOdds = price; }
      }
    };

    // ── 1. Team lines: moneyline / spreads / totals (1 call per sport) ──
    try {
      const teamData = await oddsGet(
        `/sports/${sport.oddsKey}/odds` +
        `?regions=us&markets=h2h,spreads,totals&oddsFormat=american` +
        `&bookmakers=${PREF_BOOKS.join(",")}`
      );
      for (const ev of (teamData ?? []) as any[]) {
        const label = `${ev.away_team ?? ""} @ ${ev.home_team ?? ""}`.trim();
        const books = ((ev.bookmakers ?? []) as any[])
          .sort((a, b) => PREF_BOOKS.indexOf(a.key) - PREF_BOOKS.indexOf(b.key));
        for (const book of books) {
          for (const mkt of (book.markets ?? []) as any[]) {
            for (const out of (mkt.outcomes ?? []) as any[]) {
              if (mkt.key === "h2h") {
                // Moneyline: outcome name = team name, no point
                put("team_h2h", out.name, 0, null, out.price, book.key, label);
              } else if (mkt.key === "spreads") {
                put("team_spreads", out.name, out.point ?? 0, null, out.price, book.key, label);
              } else if (mkt.key === "totals") {
                // Over/Under on game total — key by event label
                put("team_totals", label, out.point ?? 0,
                    out.name === "Over" ? "Over" : "Under", out.price, book.key, label);
              }
            }
          }
        }
      }
      log(`[odds] ${sport.ourKey}: team lines fetched`);
    } catch (e: any) {
      log(`[odds] ${sport.ourKey} team lines error: ${e.message}`);
    }

    // ── 2. Player props (main + alternate markets, 1 call per event) ──
    const marketStr = [...sport.markets, ...(sport.altMarkets ?? [])].join(",");
    // Cap at 4 events to conserve the 500/month free quota
    const slice = events.slice(0, 4);

    for (const ev of slice) {
      const label = `${ev.away_team ?? ""} @ ${ev.home_team ?? ""}`.trim();
      let evData: any;
      try {
        evData = await oddsGet(
          `/sports/${sport.oddsKey}/events/${ev.id}/odds` +
          `?regions=us&markets=${marketStr}&oddsFormat=american` +
          `&bookmakers=${PREF_BOOKS.join(",")}`
        );
      } catch (e: any) {
        log(`[odds] event ${ev.id} error: ${e.message}`);
        continue;
      }

      const books = ((evData.bookmakers ?? []) as any[])
        .sort((a, b) => PREF_BOOKS.indexOf(a.key) - PREF_BOOKS.indexOf(b.key));

      for (const book of books) {
        for (const mkt of (book.markets ?? []) as any[]) {
          for (const out of (mkt.outcomes ?? []) as any[]) {
            const name: string = out.description;
            if (!name || out.point == null) continue;
            put(mkt.key, name, out.point,
                out.name === "Over" ? "Over" : out.name === "Under" ? "Under" : null,
                out.price, book.key, label);
          }
        }
      }
    }

    // ── 3. Replace this sport's cached rows in one transaction ──
    const rows = [...collected.values()].map(d => ({
      sport:      sport.oddsKey,
      market:     d.market,
      playerName: d.playerName,
      line:       String(d.line),
      overOdds:   d.overOdds  ?? null,
      underOdds:  d.underOdds ?? null,
      book:       d.book,
      eventLabel: d.event,
      fetchedAt:  new Date(),
    }));

    if (rows.length === 0) {
      // Fetch produced nothing (likely API errors) — keep yesterday's cache
      log(`[odds] ${sport.ourKey}: no lines collected, keeping existing cache`);
      continue;
    }

    try {
      await db.transaction(async (tx) => {
        await tx.delete(oddsCacheTable).where(eq(oddsCacheTable.sport, sport.oddsKey));
        for (let i = 0; i < rows.length; i += 200) {
          await tx.insert(oddsCacheTable).values(rows.slice(i, i + 200)).onConflictDoNothing();
        }
      });
      total += rows.length;
      log(`[odds] ${sport.ourKey}: cached ${rows.length} lines (${total} total)`);
    } catch (e: any) {
      log(`[odds] ${sport.ourKey} cache replace failed (rolled back): ${e.message}`);
    }
  }

  return total;
}

// ─────────────────────────────────────────────────────────────────
// API-Sports sync
//
// Free plan constraints discovered:
//   • NBA API: /players?search={name} works WITHOUT a season filter;
//     adding ?season= requires a `team` parameter too → skip season in search
//   • Stats by player ID: /players/statistics?id={id}&season=2024 ✅
//   • Free plan seasons: 2022–2024 (NBA); WNBA/MLB need separate verification
//   • We search by last name (API searches last names), match by first name,
//     then pull game logs → compute season averages ourselves.
//
// Quota budget: ~12 players × 2 requests = 24 NBA requests/day (safe)
// ─────────────────────────────────────────────────────────────────

async function syncApiSports(log: (msg: string) => void): Promise<number> {
  if (!SPORTS_KEY) { log("API_SPORTS_KEY not set — skipping stats sync"); return 0; }

  const NBA_HOST   = "https://v2.nba.api-sports.io";
  const NBA_SEASON = 2024;  // Latest season on free plan (2022–2024)
  let total = 0;

  // ── Step 1: get our internal NBA players ─────────────────────
  let ourPlayers: { id: number; name: string }[] = [];
  try {
    ourPlayers = await db
      .select({ id: playersTable.id, name: playersTable.name })
      .from(playersTable)
      .where(eq(playersTable.sport, "NBA"))
      .limit(14); // 14 × 2 API calls = 28 requests (well within 100/day)
  } catch (e: any) {
    log(`[stats] DB query error: ${e.message}`);
    return 0;
  }

  log(`[stats] NBA: cross-referencing ${ourPlayers.length} player(s) with API-Sports…`);

  for (const player of ourPlayers) {
    const parts     = player.name.trim().split(/\s+/);
    const firstName = parts[0] ?? "";
    const lastName  = parts[parts.length - 1] ?? parts[0];

    // ── Step 2: search by last name (no season → avoids "team required" error) ─
    let apiId: number | null = null;
    try {
      const searchResp = await sportsGet(NBA_HOST, `/players?search=${encodeURIComponent(lastName)}`);
      const matches: any[] = searchResp?.response ?? [];
      // Prefer exact first+last match, then first-name-only match, then first result
      const match = matches.find(p =>
        `${p.firstname ?? ""} ${p.lastname ?? ""}`.toLowerCase() === player.name.toLowerCase()
      ) ?? matches.find(p =>
        (p.firstname ?? "").toLowerCase() === firstName.toLowerCase()
      ) ?? (matches.length === 1 ? matches[0] : null);

      apiId = match?.id ?? null;
    } catch (e: any) {
      log(`[stats] search error for ${player.name}: ${e.message}`);
      continue;
    }

    if (!apiId) {
      log(`[stats] ${player.name}: not matched in API-Sports`);
      continue;
    }

    // ── Step 3: fetch season game logs by ID ─────────────────────
    let games: any[] = [];
    try {
      const statsResp = await sportsGet(NBA_HOST, `/players/statistics?id=${apiId}&season=${NBA_SEASON}`);
      games = statsResp?.response ?? [];
    } catch (e: any) {
      log(`[stats] stats fetch error for ${player.name} (id=${apiId}): ${e.message}`);
      continue;
    }

    if (!games.length) {
      log(`[stats] ${player.name}: no game logs for season ${NBA_SEASON}`);
      continue;
    }

    // ── Step 4: compute season averages from game logs ────────────
    const played = games.filter((g: any) => g.min && g.min !== "0:00" && g.min !== "00:00");

    const numAvg = (key: string): number => {
      const vals = played.map((g: any) => Number(g[key] ?? 0)).filter(v => !isNaN(v));
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    };

    const averages = {
      points:     numAvg("points"),
      rebounds:   numAvg("totReb"),
      assists:    numAvg("assists"),
      steals:     numAvg("steals"),
      blocks:     numAvg("blocks"),
      turnovers:  numAvg("turnovers"),
      threesMade: numAvg("tpm"),
      fgPct:      numAvg("fgp"),
      ftPct:      numAvg("ftp"),
      minutes:    numAvg("min"),
    };

    const teamName = played[0]?.team?.name ?? null;
    const position = played[0]?.pos ?? null;

    // ── Step 5: upsert to DB ──────────────────────────────────────
    try {
      await db.insert(playerStatsCacheTable).values({
        sport:       "NBA",
        playerName:  player.name,
        apiPlayerId: apiId,
        teamName,
        position,
        season:      NBA_SEASON,
        statsJson:   { averages, gamesPlayed: played.length } as any,
        fetchedAt:   new Date(),
      }).onConflictDoUpdate({
        target: [playerStatsCacheTable.sport, playerStatsCacheTable.playerName, playerStatsCacheTable.season],
        set: {
          apiPlayerId: apiId,
          teamName,
          position,
          statsJson:  { averages, gamesPlayed: played.length } as any,
          fetchedAt:  new Date(),
        },
      });
      total++;
      log(
        `[stats] ✓ ${player.name} (id=${apiId}): ` +
        `${played.length}G, ${averages.points.toFixed(1)}pts ` +
        `${averages.rebounds.toFixed(1)}reb ${averages.assists.toFixed(1)}ast`
      );
    } catch (e: any) {
      log(`[stats] upsert error for ${player.name}: ${e.message}`);
    }
  }

  log(`[stats] NBA sync complete: ${total} player(s) cached`);
  return total;
}

// ─────────────────────────────────────────────────────────────────
// Main sync entry point
// ─────────────────────────────────────────────────────────────────

export type SyncType = "scheduled_5am" | "manual";

export async function runDailySync(
  triggerType: SyncType = "scheduled_5am",
  logger?: { info: (msg: string) => void; error: (msg: string) => void }
): Promise<{ oddsRecords: number; statsRecords: number; errors: string[]; durationMs: number }> {
  const startedAt = new Date();
  const errors: string[] = [];
  const log = (msg: string) => logger?.info(msg) ?? console.log(msg);

  log(`[sync] Starting ${triggerType} sync…`);

  let oddsRecords  = 0;
  let statsRecords = 0;

  try {
    oddsRecords = await syncOdds(log);
  } catch (e: any) {
    const msg = `Odds sync failed: ${e.message}`;
    errors.push(msg);
    log(`[sync] ERROR: ${msg}`);
  }

  try {
    statsRecords = await syncApiSports(log);
  } catch (e: any) {
    const msg = `Stats sync failed: ${e.message}`;
    errors.push(msg);
    log(`[sync] ERROR: ${msg}`);
  }

  const completedAt  = new Date();
  const durationMs   = completedAt.getTime() - startedAt.getTime();
  const status       = errors.length === 0 ? "success"
                     : errors.length < 2   ? "partial"
                     : "failed";

  try {
    await db.insert(syncLogTable).values({
      syncType:     triggerType,
      status,
      oddsRecords,
      statsRecords,
      errors:       errors.join("; ") || null,
      startedAt,
      completedAt,
    });
  } catch (e: any) {
    log(`[sync] Could not write sync log: ${e.message}`);
  }

  log(`[sync] Done — status=${status} odds=${oddsRecords} stats=${statsRecords} duration=${durationMs}ms`);
  return { oddsRecords, statsRecords, errors, durationMs };
}

// ─────────────────────────────────────────────────────────────────
// Scheduler — schedules at 05:00 server-local time, no deps needed
// ─────────────────────────────────────────────────────────────────

export function scheduleDailySync(logger: { info: (o: any, msg?: string) => void; error: (o: any, msg?: string) => void }) {
  function scheduleNext() {
    const now  = new Date();
    const next = new Date(now);
    next.setHours(5, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);

    const msUntil = next.getTime() - now.getTime();
    const hAway   = Math.round(msUntil / 36_000) / 100;
    logger.info({ nextSync: next.toISOString(), hoursAway: hAway }, "Daily sync scheduled");

    setTimeout(async () => {
      logger.info({}, "Running scheduled 5am sync…");
      try {
        const result = await runDailySync("scheduled_5am", {
          info:  (m) => logger.info({}, m),
          error: (m) => logger.error({}, m),
        });
        logger.info(result, "Daily sync complete");
      } catch (e: any) {
        logger.error({ err: e.message }, "Daily sync threw");
      }
      scheduleNext();          // re-arm for next day
    }, msUntil);
  }

  scheduleNext();
}

// ─────────────────────────────────────────────────────────────────
// Startup check — run immediately if no sync has happened today
// ─────────────────────────────────────────────────────────────────

export async function runStartupSyncIfNeeded(logger: { info: (o: any, msg?: string) => void }) {
  try {
    const [last] = await db
      .select()
      .from(syncLogTable)
      .orderBy(desc(syncLogTable.startedAt))
      .limit(1);

    const today5am = new Date();
    today5am.setHours(5, 0, 0, 0);

    if (!last || new Date(last.startedAt) < today5am) {
      logger.info({}, "No sync yet today — running startup sync…");
      await runDailySync("scheduled_5am", {
        info:  (m) => logger.info({}, m),
        error: (m) => logger.info({}, m),   // log errors as info to avoid noise
      });
    } else {
      logger.info({ lastSync: last.startedAt }, "Today's sync already ran — skipping");
    }
  } catch (e: any) {
    logger.info({ err: e.message }, "Startup sync check error (non-fatal)");
  }
}
