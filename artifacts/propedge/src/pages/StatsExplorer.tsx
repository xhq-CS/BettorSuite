import { useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, Search, ChevronRight, ArrowLeft, User, Users } from "lucide-react";

const BASE = (import.meta as any).env?.BASE_URL?.replace(/\/$/, "") ?? "";

type Sport   = "NBA" | "WNBA" | "MLB";
type Tab     = "players" | "teams";
type Scope   = "last5" | "last10" | "all";
type Venue   = "home" | "away" | "all";

const SPORT_STATS: Record<Sport, { key: string; label: string }[]> = {
  NBA:  [
    { key: "points", label: "Points" }, { key: "rebounds", label: "Rebounds" },
    { key: "assists", label: "Assists" }, { key: "threePointers", label: "3PM" },
    { key: "steals", label: "Steals" }, { key: "blocks", label: "Blocks" },
  ],
  WNBA: [
    { key: "points", label: "Points" }, { key: "rebounds", label: "Rebounds" },
    { key: "assists", label: "Assists" }, { key: "threePointers", label: "3PM" },
    { key: "steals", label: "Steals" }, { key: "blocks", label: "Blocks" },
  ],
  MLB:  [
    { key: "hits", label: "Hits" }, { key: "homeRuns", label: "HRs" },
    { key: "rbis", label: "RBIs" }, { key: "runs", label: "Runs" },
    { key: "strikeouts", label: "Ks" }, { key: "walks", label: "Walks" },
  ],
};

interface PlayerRow {
  playerId: number; playerName: string; teamName: string; position: string;
  last5Avg: number; last10Avg: number; last20Avg: number; seasonAvg: number;
  gamesPlayed: number;
}

interface TeamRow {
  teamId: number; teamName: string; city: string; abbreviation: string;
  logoUrl: string | null; gamesPlayed: number; wins: number; losses: number;
  winPct: number; avgScore: number; avgOppScore: number; avgMargin: number;
  avgTotalPoints: number | null; avgTotalRebounds: number | null;
  avgTotalAssists: number | null; avgThreePointersMade: number | null;
  avgTotalHits: number | null; avgTotalRuns: number | null;
  avgTotalHomeRuns: number | null;
}

// ═══════════════════════════════════════════════════════════════════
// Player stats
// ═══════════════════════════════════════════════════════════════════
function PlayerStats({ sport }: { sport: Sport }) {
  const [stat, setStat] = useState(SPORT_STATS[sport][0].key);
  const [rows, setRows] = useState<PlayerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [timeframe, setTimeframe] = useState<"last5Avg" | "last10Avg" | "last20Avg" | "seasonAvg">("seasonAvg");
  const [position, setPosition]   = useState<string>("all");
  const [teamFilter, setTeam]     = useState<string>("all");
  const [search, setSearch]       = useState("");
  const [sortAsc, setSortAsc]     = useState(false);

  useEffect(() => { setStat(SPORT_STATS[sport][0].key); setPosition("all"); setTeam("all"); }, [sport]);

  useEffect(() => {
    setLoading(true);
    fetch(`${BASE}/api/players/prop-rankings?sport=${sport}&stat=${stat}`)
      .then(r => r.json())
      .then(d => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [sport, stat]);

  const positions = useMemo(() => [...new Set(rows.map(r => r.position).filter(Boolean))].sort(), [rows]);
  const teams     = useMemo(() => [...new Set(rows.map(r => r.teamName).filter(Boolean))].sort(), [rows]);

  const displayed = useMemo(() => {
    let list = [...rows];
    if (position !== "all")   list = list.filter(r => r.position === position);
    if (teamFilter !== "all") list = list.filter(r => r.teamName === teamFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r => r.playerName.toLowerCase().includes(q));
    }
    list.sort((a, b) => sortAsc ? a[timeframe] - b[timeframe] : b[timeframe] - a[timeframe]);
    return list;
  }, [rows, position, teamFilter, search, timeframe, sortAsc]);

  const timeframes: { key: typeof timeframe; label: string }[] = [
    { key: "last5Avg",  label: "Last 5"  },
    { key: "last10Avg", label: "Last 10" },
    { key: "last20Avg", label: "Last 20" },
    { key: "seasonAvg", label: "Season"  },
  ];

  return (
    <div className="space-y-4">
      {/* Stat chips */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {SPORT_STATS[sport].map(s => (
            <button key={s.key} onClick={() => setStat(s.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${stat === s.key ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Timeframe */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          {timeframes.map(t => (
            <button key={t.key} onClick={() => setTimeframe(t.key)}
              className={`px-3 py-1 text-[11px] font-semibold transition-colors ${timeframe === t.key ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Position */}
        <select value={position} onChange={e => setPosition(e.target.value)}
          className="h-7 rounded-lg border border-border bg-card text-xs px-2 text-foreground">
          <option value="all">All positions</option>
          {positions.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        {/* Team */}
        <select value={teamFilter} onChange={e => setTeam(e.target.value)}
          className="h-7 rounded-lg border border-border bg-card text-xs px-2 text-foreground max-w-[160px]">
          <option value="all">All teams</option>
          {teams.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <div className="relative ml-auto w-44">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-xs" />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-left pl-4 pr-3 py-2.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">#</th>
                <th className="text-left px-3 py-2.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Player</th>
                <th className="text-left px-3 py-2.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Team</th>
                <th className="text-center px-3 py-2.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Pos</th>
                <th className="text-center px-3 py-2.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">L5</th>
                <th className="text-center px-3 py-2.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">L10</th>
                <th className="text-center px-3 py-2.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">L20</th>
                <th className="text-center px-3 py-2.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                  <button onClick={() => setSortAsc(a => !a)} className="flex items-center gap-1 mx-auto hover:text-foreground">
                    Season <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </button>
                </th>
                <th className="pr-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {[...Array(8)].map((_, j) => <td key={j} className="px-3 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>)}
                  </tr>
                ))
              ) : displayed.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-muted-foreground text-sm">No players match your filters.</td></tr>
              ) : displayed.map((row, i) => {
                const hl = (key: typeof timeframe) => timeframe === key ? "text-foreground font-semibold" : "text-muted-foreground";
                return (
                  <tr key={row.playerId} className="border-b border-border/40 hover:bg-muted/10 transition-colors group">
                    <td className="pl-4 pr-3 py-3 text-xs font-mono text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-3">
                      <Link href={`/stats/players/${row.playerId}`}>
                        <span className="font-semibold text-sm cursor-pointer group-hover:text-primary transition-colors">{row.playerName}</span>
                      </Link>
                      <span className="text-[10px] text-muted-foreground block">{row.gamesPlayed}G</span>
                    </td>
                    <td className="px-3 py-3"><Badge variant="outline" className="text-[10px] font-mono">{row.teamName?.split(" ").pop()}</Badge></td>
                    <td className="px-3 py-3 text-center text-xs text-muted-foreground">{row.position}</td>
                    <td className={`px-3 py-3 text-center font-mono text-sm ${hl("last5Avg")}`}>{row.last5Avg.toFixed(1)}</td>
                    <td className={`px-3 py-3 text-center font-mono text-sm ${hl("last10Avg")}`}>{row.last10Avg.toFixed(1)}</td>
                    <td className={`px-3 py-3 text-center font-mono text-sm ${hl("last20Avg")}`}>{row.last20Avg.toFixed(1)}</td>
                    <td className={`px-3 py-3 text-center font-mono text-sm ${hl("seasonAvg")}`}>{row.seasonAvg.toFixed(1)}</td>
                    <td className="pr-4 py-3 text-right">
                      <Link href={`/stats/players/${row.playerId}`}>
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary cursor-pointer" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Team stats
// ═══════════════════════════════════════════════════════════════════
function TeamStats({ sport }: { sport: Sport }) {
  const [scope, setScope] = useState<Scope>("all");
  const [venue, setVenue] = useState<Venue>("all");
  const [rows, setRows]   = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch]   = useState("");

  useEffect(() => {
    setLoading(true);
    fetch(`${BASE}/api/teams/stat-rankings?sport=${sport}&scope=${scope}&venue=${venue}`)
      .then(r => r.json())
      .then(d => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [sport, scope, venue]);

  const displayed = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(r => r.teamName.toLowerCase().includes(q) || r.city.toLowerCase().includes(q) || r.abbreviation.toLowerCase().includes(q));
  }, [rows, search]);

  const isBasketball = sport !== "MLB";

  const scopes: { key: Scope; label: string }[] = [
    { key: "last5",  label: "Last 5"  },
    { key: "last10", label: "Last 10" },
    { key: "all",    label: "Season"  },
  ];
  const venues: { key: Venue; label: string }[] = [
    { key: "all",  label: "Home + Away" },
    { key: "home", label: "Home" },
    { key: "away", label: "Away" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* Scope */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          {scopes.map(s => (
            <button key={s.key} onClick={() => setScope(s.key)}
              className={`px-3 py-1 text-[11px] font-semibold transition-colors ${scope === s.key ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50"}`}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Venue */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          {venues.map(v => (
            <button key={v.key} onClick={() => setVenue(v.key)}
              className={`px-3 py-1 text-[11px] font-semibold transition-colors ${venue === v.key ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50"}`}>
              {v.label}
            </button>
          ))}
        </div>

        <div className="relative ml-auto w-44">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Search team…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-xs" />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-left pl-4 pr-3 py-2.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">#</th>
                <th className="text-left px-3 py-2.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Team</th>
                <th className="text-center px-3 py-2.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">GP</th>
                <th className="text-center px-3 py-2.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">W–L</th>
                <th className="text-center px-3 py-2.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Win%</th>
                <th className="text-center px-3 py-2.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">PF</th>
                <th className="text-center px-3 py-2.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">PA</th>
                <th className="text-center px-3 py-2.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Margin</th>
                {isBasketball ? (
                  <>
                    <th className="text-center px-3 py-2.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Reb</th>
                    <th className="text-center px-3 py-2.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Ast</th>
                    <th className="text-center px-3 py-2.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">3PM</th>
                  </>
                ) : (
                  <>
                    <th className="text-center px-3 py-2.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Hits</th>
                    <th className="text-center px-3 py-2.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Runs</th>
                    <th className="text-center px-3 py-2.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">HRs</th>
                  </>
                )}
                <th className="pr-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {[...Array(11)].map((_, j) => <td key={j} className="px-3 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>)}
                  </tr>
                ))
              ) : displayed.length === 0 ? (
                <tr><td colSpan={12} className="text-center py-12 text-muted-foreground text-sm">No team data.</td></tr>
              ) : displayed.map((row, i) => (
                <tr key={row.teamId} className="border-b border-border/40 hover:bg-muted/10 transition-colors group">
                  <td className="pl-4 pr-3 py-3 text-xs font-mono text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-3">
                    <Link href={`/stats/teams/${row.teamId}`}>
                      <div className="flex items-center gap-2 cursor-pointer">
                        {row.logoUrl
                          ? <img src={row.logoUrl} alt={row.abbreviation} className="w-5 h-5 object-contain" />
                          : <span className="w-5 h-5 rounded bg-muted inline-block" />}
                        <span className="font-semibold text-sm group-hover:text-primary transition-colors">{row.city} {row.teamName}</span>
                      </div>
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-center font-mono text-sm">{row.gamesPlayed}</td>
                  <td className="px-3 py-3 text-center font-mono text-sm">{row.wins}–{row.losses}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={`font-mono font-semibold text-sm ${row.winPct >= 0.5 ? "text-green-400" : "text-red-400"}`}>
                      {(row.winPct * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center font-mono text-sm">{row.avgScore.toFixed(1)}</td>
                  <td className="px-3 py-3 text-center font-mono text-sm text-muted-foreground">{row.avgOppScore.toFixed(1)}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={`font-mono font-semibold text-sm ${row.avgMargin > 0 ? "text-green-400" : row.avgMargin < 0 ? "text-red-400" : ""}`}>
                      {row.avgMargin > 0 ? "+" : ""}{row.avgMargin.toFixed(1)}
                    </span>
                  </td>
                  {isBasketball ? (
                    <>
                      <td className="px-3 py-3 text-center font-mono text-sm text-muted-foreground">{row.avgTotalRebounds?.toFixed(1) ?? "—"}</td>
                      <td className="px-3 py-3 text-center font-mono text-sm text-muted-foreground">{row.avgTotalAssists?.toFixed(1) ?? "—"}</td>
                      <td className="px-3 py-3 text-center font-mono text-sm text-muted-foreground">{row.avgThreePointersMade?.toFixed(1) ?? "—"}</td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-3 text-center font-mono text-sm text-muted-foreground">{row.avgTotalHits?.toFixed(1) ?? "—"}</td>
                      <td className="px-3 py-3 text-center font-mono text-sm text-muted-foreground">{row.avgTotalRuns?.toFixed(1) ?? "—"}</td>
                      <td className="px-3 py-3 text-center font-mono text-sm text-muted-foreground">{row.avgTotalHomeRuns?.toFixed(1) ?? "—"}</td>
                    </>
                  )}
                  <td className="pr-4 py-3 text-right">
                    <Link href={`/stats/teams/${row.teamId}`}>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary cursor-pointer" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Page
// ═══════════════════════════════════════════════════════════════════
export default function StatsExplorer() {
  const [tab, setTab]     = useState<Tab>("players");
  const [sport, setSport] = useState<Sport>("NBA");

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/stats">
            <span className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors mb-1">
              <ArrowLeft className="w-3 h-3" /> Browse
            </span>
          </Link>
          <h1 className="text-2xl font-display font-bold tracking-tight mb-0.5">Stats</h1>
          <p className="text-muted-foreground text-sm">Player &amp; team performance with filters</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Player / Team stats tabs */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button onClick={() => setTab("players")}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold uppercase transition-colors ${tab === "players" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
            <User className="w-3.5 h-3.5" /> Player Stats
          </button>
          <button onClick={() => setTab("teams")}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold uppercase transition-colors ${tab === "teams" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
            <Users className="w-3.5 h-3.5" /> Team Stats
          </button>
        </div>

        {/* Sport toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          {(["NBA", "WNBA", "MLB"] as Sport[]).map(s => (
            <button key={s} onClick={() => setSport(s)}
              className={`px-4 py-1.5 text-xs font-semibold uppercase transition-colors ${sport === s ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {tab === "players" ? <PlayerStats sport={sport} /> : <TeamStats sport={sport} />}
    </div>
  );
}
