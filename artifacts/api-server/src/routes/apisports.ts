/**
 * API-Sports proxy — cross-reference official player stats
 * Free tier: 100 requests/day
 * Docs: https://api-sports.io
 */
import { Router } from "express";

export const apiSportsRouter = Router();

const KEY = process.env.API_SPORTS_KEY ?? "";

// Sport → base URL
const HOST: Record<string, string> = {
  NBA:  "https://v2.nba.api-sports.io",
  WNBA: "https://v1.basketball.api-sports.io",  // basketball league
  MLB:  "https://v1.baseball.api-sports.io",
  NFL:  "https://v1.american-football.api-sports.io",
};

// For basketball WNBA we need a league filter
const LEAGUE_ID: Record<string, number | undefined> = {
  WNBA: 17,
};

const SEASON = 2024;

// In-memory cache (30 min — conserve free tier)
const cache = new Map<string, { data: any; expires: number }>();
const TTL = 30 * 60 * 1000;

function cached(key: string) {
  const h = cache.get(key);
  return h && h.expires > Date.now() ? h.data : null;
}
function setCache(key: string, data: any) {
  cache.set(key, { data, expires: Date.now() + TTL });
}

async function apiGet(sport: string, path: string) {
  const host = HOST[sport];
  if (!host) return null;
  const url = `${host}${path}`;
  const ckey = url;
  const hit = cached(ckey);
  if (hit) return hit;

  const r = await fetch(url, {
    headers: { "x-apisports-key": KEY },
  });
  if (!r.ok) return null;
  const json = await r.json() as any;
  const data = json?.response ?? json;
  setCache(ckey, data);
  return data;
}

// GET /sports-ref/status — usage stats
apiSportsRouter.get("/status", async (_req, res) => {
  if (!KEY) return res.json({ available: false, reason: "API_SPORTS_KEY not configured" });
  try {
    // NBA status is a good proxy
    const r = await fetch(`${HOST.NBA}/status`, { headers: { "x-apisports-key": KEY } });
    const data = await r.json() as any;
    return res.json({ available: true, ...data?.response ?? data });
  } catch (e: any) {
    return res.json({ available: false, reason: e?.message });
  }
});

// GET /sports-ref/player?sport=NBA&name=LeBron+James
// Searches for a player and returns their season averages
apiSportsRouter.get("/player", async (req, res) => {
  const sport = (req.query.sport as string | undefined)?.toUpperCase() ?? "";
  const name  = (req.query.name  as string | undefined) ?? "";

  if (!KEY) return res.json({ available: false, reason: "API_SPORTS_KEY not configured", data: null });
  if (!sport || !name) return res.status(400).json({ error: "sport and name are required" });

  const host = HOST[sport];
  if (!host) return res.status(400).json({ error: `Unsupported sport: ${sport}` });

  try {
    // Step 1: find player ID
    const players = await apiGet(sport, `/players?name=${encodeURIComponent(name)}&season=${SEASON}`);
    if (!players || !players.length) {
      return res.json({ available: true, found: false, data: null });
    }

    const player = players[0];
    const playerId = player?.id ?? player?.player?.id;

    // Step 2: get their season stats
    const leagueQ = LEAGUE_ID[sport] ? `&league=${LEAGUE_ID[sport]}` : "";
    const stats = await apiGet(sport, `/players/statistics?id=${playerId}&season=${SEASON}${leagueQ}`);
    const seasonStats = Array.isArray(stats) ? stats[0] : stats;

    return res.json({
      available: true,
      found:     true,
      player: {
        id:       playerId,
        name:     player?.firstname + " " + player?.lastname || player?.player?.name,
        team:     seasonStats?.team?.name ?? null,
        position: seasonStats?.pos ?? player?.pos ?? null,
      },
      stats: seasonStats?.statistics ?? seasonStats?.games ?? seasonStats ?? null,
    });
  } catch (e: any) {
    return res.status(502).json({ available: false, reason: e?.message });
  }
});

// GET /sports-ref/league-leaders?sport=NBA&stat=points
// Returns top-N players sorted by a stat (season totals/averages)
apiSportsRouter.get("/leaders", async (req, res) => {
  const sport = (req.query.sport as string | undefined)?.toUpperCase() ?? "";

  if (!KEY) return res.json({ available: false, reason: "API_SPORTS_KEY not configured", data: [] });
  if (!sport) return res.status(400).json({ error: "sport is required" });

  const host = HOST[sport];
  if (!host) return res.status(400).json({ error: `Unsupported sport: ${sport}` });

  try {
    const leagueQ = LEAGUE_ID[sport] ? `&league=${LEAGUE_ID[sport]}` : "";
    const data = await apiGet(sport, `/players/statistics?season=${SEASON}${leagueQ}`);
    return res.json({ available: true, data: data ?? [] });
  } catch (e: any) {
    return res.status(502).json({ available: false, reason: e?.message });
  }
});
