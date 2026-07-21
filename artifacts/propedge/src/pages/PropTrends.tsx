import { useState, useMemo, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, Search, ChevronRight, TrendingUp, TrendingDown, Minus, RefreshCw, Zap } from "lucide-react";
import { formatOdds } from "@/lib/utils";

const BASE = (import.meta as any).env?.BASE_URL?.replace(/\/$/, "") ?? "";

// ── Types ─────────────────────────────────────────────────────────
type Sport = "NBA" | "WNBA" | "MLB";

const SPORT_PROPS: Record<Sport, { key: string; label: string }[]> = {
  NBA:  [
    { key: "points",        label: "Points"     },
    { key: "rebounds",      label: "Rebounds"   },
    { key: "assists",       label: "Assists"     },
    { key: "threePointers", label: "3-Pointers" },
    { key: "steals",        label: "Steals"     },
    { key: "blocks",        label: "Blocks"     },
    { key: "turnovers",     label: "Turnovers"  },
  ],
  WNBA: [
    { key: "points",        label: "Points"     },
    { key: "rebounds",      label: "Rebounds"   },
    { key: "assists",       label: "Assists"     },
    { key: "threePointers", label: "3-Pointers" },
    { key: "steals",        label: "Steals"     },
    { key: "blocks",        label: "Blocks"     },
  ],
  MLB: [
    { key: "hits",       label: "Hits"       },
    { key: "homeRuns",   label: "Home Runs"  },
    { key: "rbis",       label: "RBIs"       },
    { key: "runs",       label: "Runs"       },
    { key: "strikeouts", label: "Strikeouts" },
    { key: "walks",      label: "Walks"      },
  ],
};

interface RankRow {
  playerId:    number;
  playerName:  string;
  teamName:    string;
  position:    string;
  last5Avg:    number;
  last10Avg:   number;
  last20Avg:   number;
  seasonAvg:   number;
  gamesPlayed: number;
  high:        number;
  low:         number;
}

interface OddsLine {
  line:      number;
  overOdds:  number | null;
  underOdds: number | null;
  book:      string;
  event:     string;
}

type SortKey = "playerName" | "last5Avg" | "last10Avg" | "seasonAvg" | "line" | "hitPct";

function avg(vals: number[]) {
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}
function hitPct(avgVal: number, line: number | null) {
  return null; // can't compute from averages alone — placeholder
}

// Normalize name for fuzzy match (remove accents, lowercase)
function norm(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function matchOdds(playerName: string, oddsMap: Record<string, OddsLine>): OddsLine | null {
  const n = norm(playerName);
  for (const [oddsName, line] of Object.entries(oddsMap)) {
    if (norm(oddsName) === n) return line;
    // partial: last name match
    const parts = n.split(" ");
    if (parts.length > 1 && norm(oddsName).includes(parts[parts.length - 1])) return line;
  }
  return null;
}

function impliedProb(americanOdds: number): number {
  if (americanOdds > 0) return 100 / (americanOdds + 100);
  return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
}

function oddsColor(odds: number | null) {
  if (odds == null) return "text-muted-foreground";
  return odds < 0 ? "text-green-400" : "text-muted-foreground";
}

// Hit rate: how often does the player's recent avg exceed the line?
// We compute: seasonAvg vs line (simple indicator)
function trendVsLine(seasonAvg: number, last5Avg: number, line: number | null) {
  if (line == null) return "neutral";
  if (last5Avg > line * 1.05)  return "hot";
  if (last5Avg < line * 0.95)  return "cold";
  return "neutral";
}

export default function PropTrends() {
  const [sport, setSport]   = useState<Sport>("NBA");
  const [prop, setProp]     = useState<string>("points");
  const [rows, setRows]     = useState<RankRow[]>([]);
  const [oddsMap, setOddsMap] = useState<Record<string, OddsLine>>({});
  const [oddsAvail, setOddsAvail] = useState<boolean | null>(null);
  const [loading, setLoading]   = useState(false);
  const [oddsLoading, setOddsLoading] = useState(false);
  const [sortKey, setSortKey]   = useState<SortKey>("seasonAvg");
  const [sortAsc, setSortAsc]   = useState(false);
  const [search, setSearch]     = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const propDefs = SPORT_PROPS[sport];

  useEffect(() => {
    setProp(SPORT_PROPS[sport][0].key);
  }, [sport]);

  // Fetch prop rankings
  useEffect(() => {
    setLoading(true);
    fetch(`${BASE}/api/players/prop-rankings?sport=${sport}&stat=${prop}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setRows(d); else setRows([]); })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [sport, prop]);

  // Fetch live odds
  const fetchOdds = useCallback(() => {
    setOddsLoading(true);
    fetch(`${BASE}/api/odds/props?sport=${sport}&stat=${prop}`)
      .then(r => r.json())
      .then(d => {
        setOddsAvail(d.available ?? false);
        setOddsMap(d.players ?? {});
        setLastRefresh(new Date());
      })
      .catch(() => { setOddsAvail(false); setOddsMap({}); })
      .finally(() => setOddsLoading(false));
  }, [sport, prop]);

  useEffect(() => { fetchOdds(); }, [fetchOdds]);

  // Sort + filter
  const displayed = useMemo(() => {
    let list = [...rows];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r => r.playerName.toLowerCase().includes(q) || r.teamName.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      if (sortKey === "playerName") {
        return sortAsc ? a.playerName.localeCompare(b.playerName) : b.playerName.localeCompare(a.playerName);
      }
      if (sortKey === "line") {
        const al = matchOdds(a.playerName, oddsMap)?.line ?? -Infinity;
        const bl = matchOdds(b.playerName, oddsMap)?.line ?? -Infinity;
        return sortAsc ? al - bl : bl - al;
      }
      const av = a[sortKey as keyof RankRow] as number;
      const bv = b[sortKey as keyof RankRow] as number;
      return sortAsc ? av - bv : bv - av;
    });
    return list;
  }, [rows, search, sortKey, sortAsc, oddsMap]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(false); }
  }

  const SortTh = ({ col, label, className = "" }: { col: SortKey; label: string; className?: string }) => (
    <th className={`py-2.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider ${className}`}>
      <button onClick={() => toggleSort(col)} className="flex items-center gap-1 hover:text-foreground transition-colors">
        {label} <ArrowUpDown className="w-3 h-3 shrink-0 opacity-60" />
      </button>
    </th>
  );

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight mb-0.5">Prop Trends</h1>
          <p className="text-muted-foreground text-sm">Live lines · historical averages · trend signals</p>
        </div>

        {/* Odds status chip */}
        <div className="flex items-center gap-2">
          {oddsAvail === true && (
            <span className="flex items-center gap-1.5 text-xs text-green-400 border border-green-400/30 bg-green-400/5 rounded-full px-2.5 py-1">
              <Zap className="w-3 h-3" /> Live odds
            </span>
          )}
          {oddsAvail === false && (
            <span className="text-xs text-muted-foreground border border-border rounded-full px-2.5 py-1">No games today</span>
          )}
          <button
            onClick={fetchOdds}
            disabled={oddsLoading}
            className="w-7 h-7 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${oddsLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Sport toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          {(["NBA", "WNBA", "MLB"] as Sport[]).map(s => (
            <button key={s} onClick={() => setSport(s)}
              className={`px-4 py-1.5 text-xs font-semibold uppercase transition-colors ${sport === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
              {s}
            </button>
          ))}
        </div>

        {/* Prop chips */}
        <div className="flex flex-wrap gap-1.5">
          {propDefs.map(p => (
            <button key={p.key} onClick={() => setProp(p.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${prop === p.key ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"}`}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative ml-auto w-48">
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
                <SortTh col="playerName" label="Player"     className="text-left pl-4 pr-3" />
                <th className="text-left px-3 py-2.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Team</th>
                {oddsAvail && <SortTh col="line"  label="Line"      className="text-center px-3" />}
                <SortTh col="last5Avg"  label="L5"        className="text-center px-3" />
                <SortTh col="last10Avg" label="L10"       className="text-center px-3" />
                <SortTh col="seasonAvg" label="Season"    className="text-center px-3" />
                {oddsAvail && <th className="text-center px-3 py-2.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">vs Line</th>}
                <th className="text-center px-3 py-2.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Trend</th>
                <th className="pr-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-3 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : displayed.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-12 text-muted-foreground text-sm">No players found.</td></tr>
              ) : displayed.map(row => {
                const odds     = matchOdds(row.playerName, oddsMap);
                const line     = odds?.line ?? null;
                const trend    = trendVsLine(row.seasonAvg, row.last5Avg, line);
                const vsLineL5 = line != null ? row.last5Avg - line : null;
                const isHotL5  = row.last5Avg > row.seasonAvg * 1.08;
                const isColdL5 = row.last5Avg < row.seasonAvg * 0.92;

                return (
                  <tr key={row.playerId} className="border-b border-border/40 hover:bg-muted/10 transition-colors group">
                    {/* Player */}
                    <td className="pl-4 pr-3 py-3">
                      <Link href={`/stats/players/${row.playerId}`}>
                        <div className="cursor-pointer">
                          <div className="font-semibold text-sm group-hover:text-primary transition-colors">{row.playerName}</div>
                          <div className="text-[10px] text-muted-foreground">{row.position} · {row.gamesPlayed}G</div>
                        </div>
                      </Link>
                    </td>

                    {/* Team */}
                    <td className="px-3 py-3">
                      <Badge variant="outline" className="text-[10px] font-mono">{row.teamName?.split(" ").pop()}</Badge>
                    </td>

                    {/* Live line */}
                    {oddsAvail && (
                      <td className="px-3 py-3 text-center">
                        {odds ? (
                          <div>
                            <div className="font-mono font-bold text-sm">{odds.line}</div>
                            <div className="flex items-center justify-center gap-1 mt-0.5">
                              <span className={`text-[10px] font-mono ${oddsColor(odds.overOdds)}`}>
                                o{odds.overOdds != null ? (odds.overOdds > 0 ? "+" : "") + odds.overOdds : "–"}
                              </span>
                              <span className="text-[10px] text-muted-foreground/40">/</span>
                              <span className={`text-[10px] font-mono ${oddsColor(odds.underOdds)}`}>
                                u{odds.underOdds != null ? (odds.underOdds > 0 ? "+" : "") + odds.underOdds : "–"}
                              </span>
                            </div>
                            <div className="text-[9px] text-muted-foreground/60 mt-0.5 uppercase">{odds.book.replace("draftkings","DK").replace("fanduel","FD").replace("betmgm","MGM")}</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/40 font-mono text-xs">—</span>
                        )}
                      </td>
                    )}

                    {/* L5 avg */}
                    <td className="px-3 py-3 text-center">
                      <span className={`font-mono font-semibold text-sm ${isHotL5 ? "text-green-400" : isColdL5 ? "text-red-400" : ""}`}>
                        {row.last5Avg.toFixed(1)}
                      </span>
                    </td>

                    {/* L10 avg */}
                    <td className="px-3 py-3 text-center">
                      <span className="font-mono text-sm">{row.last10Avg.toFixed(1)}</span>
                    </td>

                    {/* Season avg */}
                    <td className="px-3 py-3 text-center">
                      <span className="font-mono text-sm text-muted-foreground">{row.seasonAvg.toFixed(1)}</span>
                    </td>

                    {/* vs Line */}
                    {oddsAvail && (
                      <td className="px-3 py-3 text-center">
                        {vsLineL5 != null ? (
                          <span className={`font-mono font-semibold text-xs ${vsLineL5 > 0 ? "text-green-400" : "text-red-400"}`}>
                            {vsLineL5 > 0 ? "+" : ""}{vsLineL5.toFixed(1)}
                          </span>
                        ) : <span className="text-muted-foreground/40 text-xs">—</span>}
                      </td>
                    )}

                    {/* Trend */}
                    <td className="px-3 py-3 text-center">
                      {trend === "hot"     && <TrendingUp   className="w-4 h-4 text-green-400 mx-auto" />}
                      {trend === "cold"    && <TrendingDown className="w-4 h-4 text-red-400 mx-auto" />}
                      {trend === "neutral" && <Minus        className="w-4 h-4 text-muted-foreground/40 mx-auto" />}
                    </td>

                    {/* Link */}
                    <td className="pr-4 py-3 text-right">
                      <Link href={`/stats/players/${row.playerId}`}>
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors cursor-pointer" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-5 text-xs text-muted-foreground pt-1">
        <span className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-green-400" /> L5 avg &gt;8% above season avg</span>
        <span className="flex items-center gap-1.5"><TrendingDown className="w-3.5 h-3.5 text-red-400" /> L5 avg &gt;8% below season avg</span>
        {oddsAvail && <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-amber-400" /> Lines from {Object.values(oddsMap)[0]?.book?.toUpperCase() ?? "DK/FD"} · cached 1hr</span>}
        {lastRefresh && <span className="ml-auto opacity-60">Updated {lastRefresh.toLocaleTimeString()}</span>}
      </div>
    </div>
  );
}
