import { Router } from "express";

export const livestatsRouter = Router();

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports";

const SPORT_PATHS: Record<string, string> = {
  nba:  "basketball/nba",
  wnba: "basketball/wnba",
  mlb:  "baseball/mlb",
  nfl:  "football/nfl",
};

async function espnFetch(path: string): Promise<any> {
  const res = await fetch(`${ESPN_BASE}${path}`, {
    headers: { "User-Agent": "BettorTracker/1.0" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`ESPN ${res.status}: ${path}`);
  return res.json() as Promise<any>;
}

function formatGame(event: any) {
  const comp   = event.competitions?.[0];
  const home   = comp?.competitors?.find((c: any) => c.homeAway === "home");
  const away   = comp?.competitors?.find((c: any) => c.homeAway === "away");
  const status = event.status?.type;
  return {
    id:          event.id,
    date:        event.date,
    name:        event.name,
    shortName:   event.shortName,
    status:      status?.shortDetail ?? "Scheduled",
    statusState: status?.state ?? "pre",          // "pre" | "in" | "post"
    statusType:  status?.name ?? "",              // "STATUS_FINAL" etc.
    homeTeam:    home?.team?.abbreviation ?? "HME",
    homeName:    home?.team?.displayName ?? "",
    homeLogo:    home?.team?.logo ?? null,
    homeScore:   home?.score != null ? Number(home.score) : null,
    homeRecord:  home?.records?.[0]?.summary ?? null,
    awayTeam:    away?.team?.abbreviation ?? "AWY",
    awayName:    away?.team?.displayName ?? "",
    awayLogo:    away?.team?.logo ?? null,
    awayScore:   away?.score != null ? Number(away.score) : null,
    awayRecord:  away?.records?.[0]?.summary ?? null,
    venue:       comp?.venue?.fullName ?? null,
    broadcast:   comp?.broadcasts?.[0]?.names?.[0] ?? null,
  };
}

function formatLeaders(data: any) {
  return (data.leaders ?? []).map((cat: any) => ({
    category:  cat.displayName,
    shortName: cat.shortDisplayName,
    leaders:   (cat.leaders ?? []).slice(0, 5).map((l: any) => ({
      rank:         l.rank,
      displayValue: l.displayValue,
      athlete: {
        id:       l.athlete?.id,
        name:     l.athlete?.displayName,
        shortName: l.athlete?.shortName,
        team:     l.team?.abbreviation,
        headshot: l.athlete?.headshot?.href ?? null,
        jersey:   l.athlete?.jersey ?? null,
      },
    })),
  }));
}

function formatNews(data: any) {
  return (data.articles ?? []).slice(0, 10).map((a: any) => ({
    id:          a.id ?? a.uid,
    headline:    a.headline,
    description: a.description ?? null,
    published:   a.published,
    image:       a.images?.[0]?.url ?? null,
    link:        a.links?.web?.href ?? null,
    categories:  (a.categories ?? []).slice(0, 3).map((c: any) => c.description ?? c.type),
  }));
}

function formatTeams(data: any) {
  const items = data.sports?.[0]?.leagues?.[0]?.teams ?? data.teams ?? [];
  return items.map((t: any) => {
    const team = t.team ?? t;
    return {
      id:           team.id,
      uid:          team.uid,
      abbreviation: team.abbreviation,
      displayName:  team.displayName,
      shortName:    team.shortDisplayName ?? team.name,
      name:         team.name,
      nickname:     team.nickname ?? null,
      location:     team.location ?? null,
      color:        team.color ? `#${team.color}` : null,
      alternateColor: team.alternateColor ? `#${team.alternateColor}` : null,
      logo:         team.logos?.[0]?.href ?? null,
      record:       team.record?.items?.[0]?.summary ?? null,
    };
  });
}

// ───────────────────────────────────────────────
// GET /livestats/:sport/scoreboard
// ───────────────────────────────────────────────
livestatsRouter.get("/:sport/scoreboard", async (req, res) => {
  const { sport } = req.params;
  const path = SPORT_PATHS[sport.toLowerCase()];
  if (!path) return res.status(400).json({ error: "Unknown sport. Use nba, wnba, mlb, or nfl." });

  try {
    const data  = await espnFetch(`/${path}/scoreboard`);
    const games = (data.events ?? []).map(formatGame);
    return res.json({ sport: sport.toUpperCase(), games, lastUpdated: new Date().toISOString() });
  } catch (e: any) {
    return res.status(502).json({ error: `Failed to fetch ${sport} scoreboard`, detail: e.message });
  }
});

// ───────────────────────────────────────────────
// GET /livestats/:sport/news
// ───────────────────────────────────────────────
livestatsRouter.get("/:sport/news", async (req, res) => {
  const { sport } = req.params;
  const path = SPORT_PATHS[sport.toLowerCase()];
  if (!path) return res.status(400).json({ error: "Unknown sport." });

  try {
    const data     = await espnFetch(`/${path}/news?limit=12`);
    const articles = formatNews(data);
    return res.json({ sport: sport.toUpperCase(), articles, lastUpdated: new Date().toISOString() });
  } catch (e: any) {
    return res.status(502).json({ error: `Failed to fetch ${sport} news`, detail: e.message });
  }
});

// ───────────────────────────────────────────────
// GET /livestats/:sport/leaders
// ───────────────────────────────────────────────
livestatsRouter.get("/:sport/leaders", async (req, res) => {
  const { sport } = req.params;
  const path = SPORT_PATHS[sport.toLowerCase()];
  if (!path) return res.status(400).json({ error: "Unknown sport." });

  try {
    const data       = await espnFetch(`/${path}/leaders`);
    const categories = formatLeaders(data);
    return res.json({ sport: sport.toUpperCase(), categories, lastUpdated: new Date().toISOString() });
  } catch (e: any) {
    return res.status(502).json({ error: `Failed to fetch ${sport} leaders`, detail: e.message });
  }
});

// ───────────────────────────────────────────────
// GET /livestats/:sport/teams
// ───────────────────────────────────────────────
livestatsRouter.get("/:sport/teams", async (req, res) => {
  const { sport } = req.params;
  const path = SPORT_PATHS[sport.toLowerCase()];
  if (!path) return res.status(400).json({ error: "Unknown sport." });

  try {
    const data  = await espnFetch(`/${path}/teams?limit=60`);
    const teams = formatTeams(data);
    return res.json({ sport: sport.toUpperCase(), teams, lastUpdated: new Date().toISOString() });
  } catch (e: any) {
    return res.status(502).json({ error: `Failed to fetch ${sport} teams`, detail: e.message });
  }
});

// ───────────────────────────────────────────────
// GET /livestats/:sport/teams/:teamId
// ───────────────────────────────────────────────
livestatsRouter.get("/:sport/teams/:teamId", async (req, res) => {
  const { sport, teamId } = req.params;
  const path = SPORT_PATHS[sport.toLowerCase()];
  if (!path) return res.status(400).json({ error: "Unknown sport." });

  try {
    const data = await espnFetch(`/${path}/teams/${teamId}`);
    const t    = data.team ?? data;
    return res.json({
      id:           t.id,
      abbreviation: t.abbreviation,
      displayName:  t.displayName,
      shortName:    t.shortDisplayName ?? t.name,
      location:     t.location ?? null,
      color:        t.color ? `#${t.color}` : null,
      logo:         t.logos?.[0]?.href ?? null,
      record:       t.record?.items?.[0]?.summary ?? null,
      athletes:     (t.athletes ?? []).slice(0, 30).map((a: any) => ({
        id:       a.id,
        name:     a.displayName,
        position: a.position?.abbreviation ?? null,
        jersey:   a.jersey ?? null,
        headshot: a.headshot?.href ?? null,
      })),
      lastUpdated: new Date().toISOString(),
    });
  } catch (e: any) {
    return res.status(502).json({ error: `Failed to fetch team ${teamId}`, detail: e.message });
  }
});

// ───────────────────────────────────────────────
// Legacy routes (kept for backward compat)
// ───────────────────────────────────────────────
livestatsRouter.get("/nba",         (_req, res) => res.redirect(307, "/api/livestats/nba/scoreboard"));
livestatsRouter.get("/wnba",        (_req, res) => res.redirect(307, "/api/livestats/wnba/scoreboard"));
livestatsRouter.get("/mlb",         (_req, res) => res.redirect(307, "/api/livestats/mlb/scoreboard"));
livestatsRouter.get("/nba/leaders", (_req, res) => res.redirect(307, "/api/livestats/nba/leaders"));
livestatsRouter.get("/mlb/leaders", (_req, res) => res.redirect(307, "/api/livestats/mlb/leaders"));
livestatsRouter.get("/nba/news",    (_req, res) => res.redirect(307, "/api/livestats/nba/news"));
