import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Activity, Trophy, Newspaper, Search, RefreshCw, Tv, MapPin, ChevronRight } from "lucide-react";
import { useListPlayers, useListTeams } from "@workspace/api-client-react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";

const SPORTS = ["nba", "wnba", "mlb"] as const;
type Sport = typeof SPORTS[number];

const SPORT_LABELS: Record<Sport, string> = { nba: "NBA", wnba: "WNBA", mlb: "MLB" };

type Tab = "scores" | "leaders" | "news";

function useEspn(sport: Sport, endpoint: string, pollMs = 0) {
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [ts, setTs]           = useState<string | null>(null);
  const BASE = (import.meta as any).env?.BASE_URL?.replace(/\/$/, "") ?? "";

  const fetch_ = useCallback(() => {
    setLoading(true);
    fetch(`${BASE}/api/livestats/${sport}/${endpoint}`)
      .then(r => r.json())
      .then(d => { setData(d); setTs(d.lastUpdated ?? null); setError(null); })
      .catch(() => setError("Failed to load data"))
      .finally(() => setLoading(false));
  }, [sport, endpoint]);

  useEffect(() => {
    fetch_();
    if (pollMs > 0) {
      const id = setInterval(fetch_, pollMs);
      return () => clearInterval(id);
    }
  }, [fetch_, pollMs]);

  return { data, loading, error, ts, refresh: fetch_ };
}

// ── Game card ────────────────────────────────────────────────────────────────
function GameCard({ game }: { game: any }) {
  const live    = game.statusState === "in";
  const final   = game.statusState === "post";
  const hasScore = game.homeScore != null;

  return (
    <Card className={`w-48 shrink-0 border transition-colors ${live ? "border-green-500/40 bg-card" : "border-border bg-card"}`}>
      <CardContent className="p-3 space-y-2">
        {/* Away */}
        <div className="flex items-center justify-between gap-2">
          {game.awayLogo
            ? <img src={game.awayLogo} alt={game.awayTeam} className="w-6 h-6 object-contain" />
            : <div className="w-6 h-6 rounded bg-muted" />}
          <span className="font-mono text-sm font-semibold flex-1">{game.awayTeam}</span>
          {hasScore && (
            <span className={`font-mono text-base font-bold ${final && game.awayScore > game.homeScore ? "text-foreground" : "text-muted-foreground"}`}>
              {game.awayScore}
            </span>
          )}
        </div>
        {/* Home */}
        <div className="flex items-center justify-between gap-2">
          {game.homeLogo
            ? <img src={game.homeLogo} alt={game.homeTeam} className="w-6 h-6 object-contain" />
            : <div className="w-6 h-6 rounded bg-muted" />}
          <span className="font-mono text-sm font-semibold flex-1">{game.homeTeam}</span>
          {hasScore && (
            <span className={`font-mono text-base font-bold ${final && game.homeScore > game.awayScore ? "text-foreground" : "text-muted-foreground"}`}>
              {game.homeScore}
            </span>
          )}
        </div>
        {/* Status */}
        <div className="pt-1 border-t border-border/50 flex items-center justify-between gap-1">
          {live && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />}
          <span className="text-[10px] text-muted-foreground truncate flex-1">{game.status}</span>
          {game.broadcast && (
            <span className="text-[9px] text-muted-foreground/60 shrink-0 flex items-center gap-0.5">
              <Tv className="w-2.5 h-2.5" />{game.broadcast}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Scores tab ───────────────────────────────────────────────────────────────
function ScoresTab({ sport }: { sport: Sport }) {
  const { data, loading, error, ts, refresh } = useEspn(sport, "scoreboard", 60_000);
  const games: any[] = data?.games ?? [];

  const live    = games.filter(g => g.statusState === "in");
  const final   = games.filter(g => g.statusState === "post");
  const upcoming = games.filter(g => g.statusState === "pre");

  if (error) return <p className="text-sm text-muted-foreground py-8 text-center">{error}</p>;

  return (
    <div className="space-y-6">
      {/* Refresh + timestamp row */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{ts ? `Updated ${formatDistanceToNow(new Date(ts))} ago` : "Loading…"}</span>
        <button onClick={refresh} className="flex items-center gap-1 hover:text-foreground transition-colors">
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {loading && !data && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {[...Array(5)].map((_, i) => <div key={i} className="w-48 h-28 shrink-0 bg-muted animate-pulse rounded-lg" />)}
        </div>
      )}

      {!loading && games.length === 0 && (
        <div className="py-12 text-center text-muted-foreground text-sm border border-dashed border-border rounded-lg">
          No games scheduled today for {SPORT_LABELS[sport]}.
        </div>
      )}

      {live.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-green-400 mb-3 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Live Now
          </h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {live.map(g => <GameCard key={g.id} game={g} />)}
          </div>
        </div>
      )}

      {final.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Final</h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {final.map(g => <GameCard key={g.id} game={g} />)}
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Upcoming</h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {upcoming.map(g => <GameCard key={g.id} game={g} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Leaders tab ──────────────────────────────────────────────────────────────
function LeadersTab({ sport }: { sport: Sport }) {
  const { data, loading, error, ts } = useEspn(sport, "leaders");
  const categories: any[] = data?.categories ?? [];

  if (loading) return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />)}
    </div>
  );
  if (error) return <p className="text-sm text-muted-foreground py-8 text-center">{error}</p>;
  if (categories.length === 0) return <p className="text-sm text-muted-foreground py-8 text-center">No leader data available for {SPORT_LABELS[sport]}.</p>;

  return (
    <div className="space-y-4">
      {ts && <p className="text-xs text-muted-foreground">Updated {formatDistanceToNow(new Date(ts))} ago</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat) => (
          <Card key={cat.category} className="border-border bg-card">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-primary">{cat.category}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2.5">
              {cat.leaders.map((l: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-muted-foreground w-4 shrink-0">{l.rank}</span>
                  {l.athlete.headshot
                    ? <img src={l.athlete.headshot} alt={l.athlete.name} className="w-8 h-8 rounded-full object-cover bg-muted shrink-0" />
                    : <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-[10px] font-bold text-muted-foreground">{l.athlete.shortName?.charAt(0)}</div>
                  }
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{l.athlete.name}</div>
                    <div className="text-[10px] text-muted-foreground">{l.athlete.team}</div>
                  </div>
                  <span className="font-mono font-bold text-sm shrink-0 bg-muted/50 px-2 py-0.5 rounded">
                    {l.displayValue}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── News tab ─────────────────────────────────────────────────────────────────
function NewsTab({ sport }: { sport: Sport }) {
  const { data, loading, error, ts } = useEspn(sport, "news");
  const articles: any[] = data?.articles ?? [];

  if (loading) return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}
    </div>
  );
  if (error) return <p className="text-sm text-muted-foreground py-8 text-center">{error}</p>;
  if (articles.length === 0) return <p className="text-sm text-muted-foreground py-8 text-center">No news available.</p>;

  return (
    <div className="space-y-3">
      {ts && <p className="text-xs text-muted-foreground">Updated {formatDistanceToNow(new Date(ts))} ago</p>}
      {articles.map((a) => (
        <a
          key={a.id}
          href={a.link ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <Card className="border-border bg-card hover:border-primary/40 hover:bg-muted/20 transition-colors">
            <CardContent className="p-4 flex gap-4">
              {a.image && (
                <img
                  src={a.image}
                  alt={a.headline}
                  className="w-20 h-16 object-cover rounded shrink-0 bg-muted"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm leading-snug mb-1 line-clamp-2">{a.headline}</p>
                {a.description && <p className="text-xs text-muted-foreground line-clamp-2">{a.description}</p>}
                <div className="flex items-center gap-2 mt-2">
                  {a.published && (
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(a.published))} ago
                    </span>
                  )}
                  <ChevronRight className="w-3 h-3 text-muted-foreground ml-auto" />
                </div>
              </div>
            </CardContent>
          </Card>
        </a>
      ))}
    </div>
  );
}

// ── Teams panel (ESPN) ───────────────────────────────────────────────────────
function TeamsPanel({ sport }: { sport: Sport }) {
  const { data, loading } = useEspn(sport, "teams");
  const teams: any[] = data?.teams ?? [];

  if (loading) return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
      {[...Array(12)].map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded" />)}
    </div>
  );

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
      {teams.map((t) => (
        <div key={t.id} className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-border bg-card hover:border-primary/30 transition-colors cursor-default">
          {t.logo
            ? <img src={t.logo} alt={t.abbreviation} className="w-8 h-8 object-contain" />
            : <div className="w-8 h-8 rounded bg-muted" />}
          <span className="text-[10px] font-mono font-bold">{t.abbreviation}</span>
          {t.record && <span className="text-[9px] text-muted-foreground">{t.record}</span>}
        </div>
      ))}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function StatsHub() {
  const [sport, setSport]       = useState<Sport>("nba");
  const [tab, setTab]           = useState<Tab>("scores");
  const [search, setSearch]     = useState("");
  const [playerSport, setPlayerSport] = useState("NBA");

  const { data: players, isLoading: playersLoading } = useListPlayers({ sport: playerSport, search });
  const { data: dbTeams, isLoading: dbTeamsLoading } = useListTeams({ sport: playerSport });

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "scores",  label: "Scores",  icon: <Activity className="w-3.5 h-3.5" /> },
    { key: "leaders", label: "Leaders", icon: <Trophy className="w-3.5 h-3.5" /> },
    { key: "news",    label: "News",    icon: <Newspaper className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight mb-1">Live Stats</h1>
        <p className="text-muted-foreground text-sm">Real-time scores, leaders, and news from ESPN</p>
      </div>

      {/* ── ESPN live section ─────────────────────────── */}
      <div className="space-y-4">
        {/* Sport + tab bar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Sport selector */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            {SPORTS.map(s => (
              <button
                key={s}
                onClick={() => setSport(s)}
                className={`px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  sport === s
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {SPORT_LABELS[s]}
              </button>
            ))}
          </div>

          {/* Tab selector */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium transition-colors ${
                  tab === t.key
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {t.icon}{t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div>
          {tab === "scores"  && <ScoresTab  sport={sport} />}
          {tab === "leaders" && <LeadersTab sport={sport} />}
          {tab === "news"    && <NewsTab    sport={sport} />}
        </div>

        {/* Teams from ESPN */}
        {tab === "scores" && (
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> {SPORT_LABELS[sport]} Teams
            </h3>
            <TeamsPanel sport={sport} />
          </div>
        )}
      </div>

      <div className="h-px w-full bg-border" />

      {/* ── Player / team search (DB) ─────────────────── */}
      <div className="space-y-6">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex rounded-lg border border-border overflow-hidden">
            {["NBA", "WNBA", "MLB"].map(s => (
              <button
                key={s}
                onClick={() => setPlayerSport(s)}
                className={`px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  playerSport === s
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search players or teams…"
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Players grid */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Players</h2>
          {playersLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {players?.slice(0, 12).map(p => (
                <Link key={p.id} href={`/stats/players/${p.id}`}>
                  <Card className="hover:border-primary/40 transition-colors cursor-pointer group bg-card">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground group-hover:text-primary transition-colors shrink-0">
                        {p.number ? `#${p.number}` : p.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate group-hover:text-primary transition-colors">{p.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{p.teamName} · {p.position}</div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
              {(!players || players.length === 0) && !playersLoading && (
                <div className="col-span-full py-10 text-center text-muted-foreground text-sm border border-dashed border-border rounded-lg">
                  No players found.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Teams grid */}
        {(!search || dbTeams?.some(t => t.name.toLowerCase().includes(search.toLowerCase()))) && (
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Teams</h2>
            {dbTeamsLoading ? (
              <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-3">
                {[...Array(6)].map((_, i) => <div key={i} className="h-14 bg-muted animate-pulse rounded" />)}
              </div>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-3">
                {dbTeams?.filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase())).map(t => (
                  <Link key={t.id} href={`/stats/teams/${t.id}`}>
                    <Card className="hover:border-primary/40 transition-colors cursor-pointer group bg-card">
                      <CardContent className="p-3 text-center">
                        <div className="font-mono font-bold text-sm group-hover:text-primary transition-colors">{t.abbreviation}</div>
                        <div className="text-[10px] text-muted-foreground truncate mt-0.5">{t.name}</div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
