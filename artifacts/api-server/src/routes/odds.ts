/**
 * Odds proxy — The Odds API v4
 * Player props require:
 *   Step 1: GET /sports/{sport}/events           → get today's event IDs
 *   Step 2: GET /sports/{sport}/events/{id}/odds → get player prop lines per event
 * Free tier: 500 requests/month; responses are cached 1 hr to conserve quota.
 */
import { Router } from "express";

export const oddsRouter = Router();

const ODDS_API_KEY = process.env.ODDS_API_KEY ?? "";
const BASE        = "https://api.the-odds-api.com/v4";

// ── Sport / market maps ─────────────────────────────────────────
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
};

// ── In-memory cache (1 hour TTL) ────────────────────────────────
interface CacheEntry { data: any; expires: number; }
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hr

function getCached(key: string) {
  const h = cache.get(key);
  return h && h.expires > Date.now() ? h.data : null;
}
function setCache(key: string, data: any) {
  cache.set(key, { data, expires: Date.now() + CACHE_TTL });
}

// ── Bookmaker preference ─────────────────────────────────────────
const PREF_BOOKS = ["draftkings", "fanduel", "betmgm", "williamhill_us", "bovada"];

interface PlayerLine {
  line:      number;
  overOdds:  number | null;
  underOdds: number | null;
  book:      string;
  event:     string;
}

async function oddsGet(path: string): Promise<any> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${BASE}${path}${sep}apiKey=${ODDS_API_KEY}`;
  const r = await fetch(url);
  if (!r.ok) {
    const text = await r.text().catch(() => r.statusText);
    throw Object.assign(new Error(`Odds API ${r.status}: ${text}`), { status: r.status });
  }
  return r.json();
}

// GET /odds/props?sport=NBA&stat=points
oddsRouter.get("/props", async (req, res) => {
  const sport = (req.query.sport as string | undefined)?.toUpperCase() ?? "";
  const stat  = (req.query.stat  as string | undefined) ?? "";

  if (!ODDS_API_KEY) {
    return res.json({ available: false, reason: "ODDS_API_KEY not configured", players: {}, games: 0 });
  }

  const sportKey = SPORT_KEY[sport];
  const market   = STAT_MARKET[sport]?.[stat];

  if (!sportKey || !market) {
    return res.status(400).json({ error: `Unsupported sport '${sport}' or stat '${stat}'` });
  }

  const cacheKey = `${sportKey}:${market}`;
  const hit = getCached(cacheKey);
  if (hit) return res.json(hit);

  try {
    // ── Step 1: get upcoming events ──────────────────────────────
    const events: any[] = await oddsGet(
      `/sports/${sportKey}/events?dateFormat=iso`
    );

    if (!events || events.length === 0) {
      const result = { available: false, reason: "No games scheduled today", players: {}, games: 0, cached_at: new Date().toISOString() };
      setCache(cacheKey, result);
      return res.json(result);
    }

    // Limit to first 6 events to conserve free-tier quota
    const eventSlice = events.slice(0, 6);

    // ── Step 2: fetch player props per event in parallel ─────────
    const propResponses = await Promise.allSettled(
      eventSlice.map((ev: any) =>
        oddsGet(
          `/sports/${sportKey}/events/${ev.id}/odds` +
          `?regions=us&markets=${market}&oddsFormat=american` +
          `&bookmakers=${PREF_BOOKS.join(",")}`
        )
      )
    );

    const players: Record<string, PlayerLine> = {};

    propResponses.forEach((settled, i) => {
      if (settled.status !== "fulfilled") return;
      const ev = settled.value;
      const eventLabel = `${ev.away_team ?? ""} @ ${ev.home_team ?? ""}`.trim();

      const books: any[] = (ev.bookmakers ?? []).sort(
        (a: any, b: any) => PREF_BOOKS.indexOf(a.key) - PREF_BOOKS.indexOf(b.key)
      );

      for (const book of books) {
        const mkt = (book.markets ?? []).find((m: any) => m.key === market);
        if (!mkt) continue;

        for (const outcome of mkt.outcomes ?? []) {
          const name: string = outcome.description;
          if (!name) continue;

          // Only upgrade if we're using a more-preferred book
          if (players[name] && PREF_BOOKS.indexOf(players[name].book) <= PREF_BOOKS.indexOf(book.key)) {
            // Just fill in missing over/under from same or less-pref book
            if (outcome.name === "Over"  && players[name].overOdds  == null) players[name].overOdds  = outcome.price;
            if (outcome.name === "Under" && players[name].underOdds == null) players[name].underOdds = outcome.price;
            continue;
          }

          if (!players[name]) {
            players[name] = { line: outcome.point, overOdds: null, underOdds: null, book: book.key, event: eventLabel };
          }
          players[name].book  = book.key;
          players[name].event = eventLabel;
          players[name].line  = outcome.point;
          if (outcome.name === "Over")  players[name].overOdds  = outcome.price;
          if (outcome.name === "Under") players[name].underOdds = outcome.price;
        }
      }
    });

    const playerCount = Object.keys(players).length;
    const result = {
      available:  playerCount > 0,
      reason:     playerCount === 0 ? "No player prop lines available yet" : undefined,
      players,
      games:      eventSlice.length,
      market,
      cached_at:  new Date().toISOString(),
    };

    setCache(cacheKey, result);
    return res.json(result);

  } catch (err: any) {
    const status = err.status ?? 502;
    return res.status(status).json({ available: false, reason: err.message, players: {}, games: 0 });
  }
});

// GET /odds/events?sport=NBA — list today's games
oddsRouter.get("/events", async (req, res) => {
  const sport = (req.query.sport as string | undefined)?.toUpperCase() ?? "";
  const sportKey = SPORT_KEY[sport];
  if (!sportKey) return res.status(400).json({ error: "Invalid sport" });
  if (!ODDS_API_KEY) return res.json({ available: false, events: [] });

  const cacheKey = `events:${sportKey}`;
  const hit = getCached(cacheKey);
  if (hit) return res.json(hit);

  try {
    const data = await oddsGet(`/sports/${sportKey}/events?dateFormat=iso`);
    const result = { available: true, events: data ?? [], cached_at: new Date().toISOString() };
    setCache(cacheKey, result);
    return res.json(result);
  } catch (err: any) {
    return res.json({ available: false, events: [], reason: err.message });
  }
});
