import { useState, useMemo, useEffect, useCallback, Fragment } from "react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowUpDown, Search, ChevronRight, ChevronDown, TrendingUp, TrendingDown,
  Minus, RefreshCw, Zap, User, Users,
} from "lucide-react";

const BASE = (import.meta as any).env?.BASE_URL?.replace(/\/$/, "") ?? "";

// ── Types ─────────────────────────────────────────────────────────
type Sport    = "NBA" | "WNBA" | "MLB";
type Category = "player" | "team";
type OUFilter = "all" | "over" | "under";
type LineType = "main" | "alternate";

const SPORT_PROPS: Record<Sport, { key: string; label: string; hasAlt?: boolean }[]> = {
  NBA:  [
    { key: "points",        label: "Points",     hasAlt: true },
    { key: "rebounds",      label: "Rebounds",   hasAlt: true },
    { key: "assists",       label: "Assists",    hasAlt: true },
    { key: "threePointers", label: "3-Pointers", hasAlt: true },
    { key: "steals",        label: "Steals"     },
    { key: "blocks",        label: "Blocks"     },
    { key: "turnovers",     label: "Turnovers"  },
  ],
  WNBA: [
    { key: "points",        label: "Points",     hasAlt: true },
    { key: "rebounds",      label: "Rebounds",   hasAlt: true },
    { key: "assists",       label: "Assists",    hasAlt: true },
    { key: "threePointers", label: "3-Pointers" },
    { key: "steals",        label: "Steals"     },
    { key: "blocks",        label: "Blocks"     },
  ],
  MLB: [
    { key: "hits",       label: "Hits",       hasAlt: true },
    { key: "homeRuns",   label: "Home Runs",  hasAlt: true },
    { key: "rbis",       label: "RBIs"       },
    { key: "runs",       label: "Runs"       },
    { key: "strikeouts", label: "Strikeouts", hasAlt: true },
    { key: "walks",      label: "Walks"      },
  ],
};

type TeamBetType = "moneyline" | "spread" | "total";

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
}

interface OddsLine {
  line:      number;
  overOdds:  number | null;
  underOdds: number | null;
  book:      string;
  event:     string;
}

interface TeamLineEvent {
  event: string;
  book:  string;
  teams: { team: string; moneyline: number | null; spread: number | null; spreadOdds: number | null }[];
  total: { line: number; overOdds: number | null; underOdds: number | null } | null;
}

type SortKey = "playerName" | "last5Avg" | "last10Avg" | "seasonAvg" | "line";

function norm(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function matchOdds<T>(playerName: string, oddsMap: Record<string, T>): T | null {
  const n = norm(playerName);
  for (const [oddsName, line] of Object.entries(oddsMap)) {
    if (norm(oddsName) === n) return line;
    const parts = n.split(" ");
    if (parts.length > 1 && norm(oddsName).includes(parts[parts.length - 1])) return line;
  }
  return null;
}

function fmtOdds(o: number | null): string {
  if (o == null) return "–";
  return (o > 0 ? "+" : "") + o;
}

function oddsColor(odds: number | null) {
  if (odds == null) return "text-muted-foreground";
  return odds < 0 ? "text-green-400" : "text-muted-foreground";
}

function bookAbbr(b: string) {
  return b.replace("draftkings", "DK").replace("fanduel", "FD").replace("betmgm", "MGM")
          .replace("williamhill_us", "CZR").replace("bovada", "BOV").toUpperCase();
}

function trendVsLine(last5Avg: number, line: number | null) {
  if (line == null) return "neutral";
  if (last5Avg > line * 1.05)  return "hot";
  if (last5Avg < line * 0.95)  return "cold";
  return "neutral";
}

// ═══════════════════════════════════════════════════════════════════
// Player props tab
// ═══════════════════════════════════════════════════════════════════
function PlayerTab({ sport }: { sport: Sport }) {
  const [prop, setProp]       = useState<string>(SPORT_PROPS[sport][0].key);
  const [ouFilter, setOu]     = useState<OUFilter>("all");
  const [lineType, setLineType] = useState<LineType>("main");
  const [rows, setRows]       = useState<RankRow[]>([]);
  const [oddsMap, setOddsMap] = useState<Record<string, OddsLine>>({});
  const [altMap, setAltMap]   = useState<Record<string, OddsLine[]>>({});
  const [oddsAvail, setOddsAvail] = useState<boolean | null>(null);
  const [altAvail, setAltAvail]   = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [oddsLoading, setOddsLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("seasonAvg");
  const [sortAsc, setSortAsc] = useState(false);
  const [search, setSearch]   = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);

  const propDefs = SPORT_PROPS[sport];
  const currentProp = propDefs.find(p => p.key === prop);

  useEffect(() => {
    setProp(SPORT_PROPS[sport][0].key);
    setLineType("main");
  }, [sport]);

  // Reset to main if prop has no alternates
  useEffect(() => {
    if (lineType === "alternate" && !currentProp?.hasAlt) setLineType("main");
  }, [prop]); // eslint-disable-line

  useEffect(() => {
    setLoading(true);
    fetch(`${BASE}/api/players/prop-rankings?sport=${sport}&stat=${prop}`)
      .then(r => r.json())
      .then(d => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [sport, prop]);

  const fetchOdds = useCallback(() => {
    setOddsLoading(true);
    const mainReq = fetch(`${BASE}/api/odds/props?sport=${sport}&stat=${prop}`)
      .then(r => r.json());
    const altReq = currentProp?.hasAlt
      ? fetch(`${BASE}/api/odds/props?sport=${sport}&stat=${prop}&lineType=alternate`).then(r => r.json())
      : Promise.resolve({ players: {} });

    Promise.all([mainReq, altReq])
      .then(([main, alt]) => {
        setOddsAvail(main.available ?? false);
        setOddsMap(main.players ?? {});
        setAltAvail(alt.available ?? false);
        setAltMap(alt.players ?? {});
      })
      .catch(() => { setOddsAvail(false); setAltAvail(false); setOddsMap({}); setAltMap({}); })
      .finally(() => setOddsLoading(false));
  }, [sport, prop, currentProp?.hasAlt]);

  useEffect(() => { fetchOdds(); }, [fetchOdds]);

  const showLines = lineType === "alternate" ? altAvail : (oddsAvail ?? false);

  const displayed = useMemo(() => {
    let list = [...rows];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r => r.playerName.toLowerCase().includes(q) || r.teamName.toLowerCase().includes(q));
    }
    // In alternate mode, only show players that have alternate lines
    if (lineType === "alternate") {
      list = list.filter(r => matchOdds(r.playerName, altMap) != null);
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
  }, [rows, search, sortKey, sortAsc, oddsMap, altMap, lineType]);

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
    <div className="space-y-4">
      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Bet type chips */}
        <div className="flex flex-wrap gap-1.5">
          {propDefs.map(p => (
            <button key={p.key} onClick={() => setProp(p.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${prop === p.key ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"}`}>
              {p.label}
            </button>
          ))}
        </div>

        <div className="h-5 w-px bg-border hidden sm:block" />

        {/* Over/Under filter */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          {(["all", "over", "under"] as OUFilter[]).map(f => (
            <button key={f} onClick={() => setOu(f)}
              className={`px-3 py-1 text-[11px] font-semibold uppercase transition-colors ${ouFilter === f ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50"}`}>
              {f === "all" ? "O/U" : f}
            </button>
          ))}
        </div>

        {/* Main / Alternate lines */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          {(["main", "alternate"] as LineType[]).map(f => (
            <button key={f} onClick={() => setLineType(f)}
              disabled={f === "alternate" && !currentProp?.hasAlt}
              className={`px-3 py-1 text-[11px] font-semibold uppercase transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${lineType === f ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50"}`}>
              {f === "main" ? "Main Lines" : "Alt Lines"}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative ml-auto w-44">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-xs" />
        </div>

        <button onClick={fetchOdds} disabled={oddsLoading}
          className="w-7 h-7 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40">
          <RefreshCw className={`w-3.5 h-3.5 ${oddsLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <SortTh col="playerName" label="Player" className="text-left pl-4 pr-3" />
                <th className="text-left px-3 py-2.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Team</th>
                {showLines && <SortTh col="line" label={lineType === "alternate" ? "Alt Lines" : "Line"} className="text-center px-3" />}
                <SortTh col="last5Avg"  label="L5"     className="text-center px-3" />
                <SortTh col="last10Avg" label="L10"    className="text-center px-3" />
                <SortTh col="seasonAvg" label="Season" className="text-center px-3" />
                {showLines && <th className="text-center px-3 py-2.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">vs Line</th>}
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
                <tr><td colSpan={10} className="text-center py-12 text-muted-foreground text-sm">
                  {lineType === "alternate" ? "No alternate lines cached for this market." : "No players found."}
                </td></tr>
              ) : displayed.map(row => {
                const odds     = matchOdds(row.playerName, oddsMap);
                const altLines = lineType === "alternate" ? matchOdds(row.playerName, altMap) : null;
                const line     = odds?.line ?? null;
                const trend    = trendVsLine(row.last5Avg, line);
                const vsLineL5 = line != null ? row.last5Avg - line : null;
                const isHotL5  = row.last5Avg > row.seasonAvg * 1.08;
                const isColdL5 = row.last5Avg < row.seasonAvg * 0.92;
                const isExpanded = expanded === row.playerId;

                return (
                  <Fragment key={row.playerId}>
                    <tr
                        className={`border-b border-border/40 hover:bg-muted/10 transition-colors group ${lineType === "alternate" ? "cursor-pointer" : ""}`}
                        onClick={() => lineType === "alternate" && setExpanded(isExpanded ? null : row.playerId)}>
                      <td className="pl-4 pr-3 py-3">
                        <Link href={`/stats/players/${row.playerId}`} onClick={e => e.stopPropagation()}>
                          <div className="cursor-pointer">
                            <div className="font-semibold text-sm group-hover:text-primary transition-colors">{row.playerName}</div>
                            <div className="text-[10px] text-muted-foreground">{row.position} · {row.gamesPlayed}G</div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant="outline" className="text-[10px] font-mono">{row.teamName?.split(" ").pop()}</Badge>
                      </td>
                      {showLines && (
                        <td className="px-3 py-3 text-center">
                          {lineType === "alternate" && altLines ? (
                            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                              <span className="font-mono font-semibold text-foreground">{altLines.length} lines</span>
                              <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                            </div>
                          ) : odds ? (
                            <div>
                              <div className="font-mono font-bold text-sm">{odds.line}</div>
                              <div className="flex items-center justify-center gap-1 mt-0.5">
                                {ouFilter !== "under" && (
                                  <span className={`text-[10px] font-mono ${oddsColor(odds.overOdds)}`}>o{fmtOdds(odds.overOdds)}</span>
                                )}
                                {ouFilter === "all" && <span className="text-[10px] text-muted-foreground/40">/</span>}
                                {ouFilter !== "over" && (
                                  <span className={`text-[10px] font-mono ${oddsColor(odds.underOdds)}`}>u{fmtOdds(odds.underOdds)}</span>
                                )}
                              </div>
                              <div className="text-[9px] text-muted-foreground/60 mt-0.5 uppercase">{bookAbbr(odds.book)}</div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground/40 font-mono text-xs">—</span>
                          )}
                        </td>
                      )}
                      <td className="px-3 py-3 text-center">
                        <span className={`font-mono font-semibold text-sm ${isHotL5 ? "text-green-400" : isColdL5 ? "text-red-400" : ""}`}>
                          {row.last5Avg.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center"><span className="font-mono text-sm">{row.last10Avg.toFixed(1)}</span></td>
                      <td className="px-3 py-3 text-center"><span className="font-mono text-sm text-muted-foreground">{row.seasonAvg.toFixed(1)}</span></td>
                      {showLines && (
                        <td className="px-3 py-3 text-center">
                          {vsLineL5 != null ? (
                            <span className={`font-mono font-semibold text-xs ${vsLineL5 > 0 ? "text-green-400" : "text-red-400"}`}>
                              {vsLineL5 > 0 ? "+" : ""}{vsLineL5.toFixed(1)}
                            </span>
                          ) : <span className="text-muted-foreground/40 text-xs">—</span>}
                        </td>
                      )}
                      <td className="px-3 py-3 text-center">
                        {trend === "hot"     && <TrendingUp   className="w-4 h-4 text-green-400 mx-auto" />}
                        {trend === "cold"    && <TrendingDown className="w-4 h-4 text-red-400 mx-auto" />}
                        {trend === "neutral" && <Minus        className="w-4 h-4 text-muted-foreground/40 mx-auto" />}
                      </td>
                      <td className="pr-4 py-3 text-right">
                        <Link href={`/stats/players/${row.playerId}`} onClick={e => e.stopPropagation()}>
                          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors cursor-pointer" />
                        </Link>
                      </td>
                    </tr>

                    {/* Alternate line ladder */}
                    {lineType === "alternate" && isExpanded && altLines && (
                      <tr className="border-b border-border/40 bg-muted/5">
                        <td colSpan={10} className="px-6 py-3">
                          <div className="flex flex-wrap gap-2">
                            {altLines
                              .filter(l => ouFilter === "all" || (ouFilter === "over" ? l.overOdds != null : l.underOdds != null))
                              .map((l, i) => (
                              <div key={i} className="rounded-lg border border-border bg-card px-3 py-2 text-center min-w-[76px]">
                                <div className="font-mono font-bold text-sm">{l.line}</div>
                                <div className="flex items-center justify-center gap-1 mt-0.5">
                                  {ouFilter !== "under" && <span className={`text-[10px] font-mono ${oddsColor(l.overOdds)}`}>o{fmtOdds(l.overOdds)}</span>}
                                  {ouFilter === "all" && <span className="text-[10px] text-muted-foreground/40">/</span>}
                                  {ouFilter !== "over" && <span className={`text-[10px] font-mono ${oddsColor(l.underOdds)}`}>u{fmtOdds(l.underOdds)}</span>}
                                </div>
                                <div className="text-[9px] text-muted-foreground/60 mt-0.5 uppercase">{bookAbbr(l.book)}</div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-5 text-xs text-muted-foreground pt-1">
        <span className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-green-400" /> L5 avg above the line</span>
        <span className="flex items-center gap-1.5"><TrendingDown className="w-3.5 h-3.5 text-red-400" /> L5 avg below the line</span>
        {showLines && <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-amber-400" /> Lines refresh daily at 5am</span>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Team lines tab
// ═══════════════════════════════════════════════════════════════════
function TeamTab({ sport }: { sport: Sport }) {
  const [betType, setBetType] = useState<TeamBetType>("moneyline");
  const [ouFilter, setOu]     = useState<OUFilter>("all");
  const [events, setEvents]   = useState<TeamLineEvent[]>([]);
  const [avail, setAvail]     = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch]   = useState("");

  useEffect(() => {
    setLoading(true);
    fetch(`${BASE}/api/odds/team-lines?sport=${sport}`)
      .then(r => r.json())
      .then(d => { setAvail(d.available ?? false); setEvents(d.events ?? []); })
      .catch(() => { setAvail(false); setEvents([]); })
      .finally(() => setLoading(false));
  }, [sport]);

  const displayed = useMemo(() => {
    if (!search.trim()) return events;
    const q = search.toLowerCase();
    return events.filter(e =>
      e.event.toLowerCase().includes(q) ||
      e.teams.some(t => t.team.toLowerCase().includes(q))
    );
  }, [events, search]);

  const betTypes: { key: TeamBetType; label: string }[] = [
    { key: "moneyline", label: "Moneyline" },
    { key: "spread",    label: "Spread"    },
    { key: "total",     label: "Total"     },
  ];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {betTypes.map(b => (
            <button key={b.key} onClick={() => setBetType(b.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${betType === b.key ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"}`}>
              {b.label}
            </button>
          ))}
        </div>

        {betType === "total" && (
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["all", "over", "under"] as OUFilter[]).map(f => (
              <button key={f} onClick={() => setOu(f)}
                className={`px-3 py-1 text-[11px] font-semibold uppercase transition-colors ${ouFilter === f ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50"}`}>
                {f === "all" ? "O/U" : f}
              </button>
            ))}
          </div>
        )}

        <div className="relative ml-auto w-44">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Search team…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-xs" />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : avail === false || displayed.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground text-sm border border-dashed border-border rounded-xl">
          {avail === false ? "No team lines cached — sync runs daily at 5am." : "No matching games."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {displayed.map(ev => (
            <div key={ev.event} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-muted-foreground">{ev.event}</span>
                <span className="text-[9px] text-muted-foreground/60 uppercase">{bookAbbr(ev.book)}</span>
              </div>

              {betType === "moneyline" && (
                <div className="space-y-2">
                  {ev.teams.map(t => (
                    <div key={t.team} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-muted/20">
                      <span className="text-sm font-medium">{t.team}</span>
                      <span className={`font-mono font-bold text-sm ${oddsColor(t.moneyline)}`}>{fmtOdds(t.moneyline)}</span>
                    </div>
                  ))}
                </div>
              )}

              {betType === "spread" && (
                <div className="space-y-2">
                  {ev.teams.map(t => (
                    <div key={t.team} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-muted/20">
                      <span className="text-sm font-medium">{t.team}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-sm">{t.spread != null ? (t.spread > 0 ? "+" : "") + t.spread : "—"}</span>
                        <span className={`font-mono text-xs ${oddsColor(t.spreadOdds)}`}>{fmtOdds(t.spreadOdds)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {betType === "total" && (
                ev.total ? (
                  <div className="flex items-center justify-center gap-6 py-2">
                    <div className="text-center">
                      <div className="text-[10px] text-muted-foreground uppercase mb-0.5">Total</div>
                      <div className="font-mono font-bold text-xl">{ev.total.line}</div>
                    </div>
                    <div className="flex gap-3">
                      {ouFilter !== "under" && (
                        <div className="text-center rounded-lg border border-border px-3 py-1.5">
                          <div className="text-[10px] text-muted-foreground uppercase">Over</div>
                          <div className={`font-mono font-semibold text-sm ${oddsColor(ev.total.overOdds)}`}>{fmtOdds(ev.total.overOdds)}</div>
                        </div>
                      )}
                      {ouFilter !== "over" && (
                        <div className="text-center rounded-lg border border-border px-3 py-1.5">
                          <div className="text-[10px] text-muted-foreground uppercase">Under</div>
                          <div className={`font-mono font-semibold text-sm ${oddsColor(ev.total.underOdds)}`}>{fmtOdds(ev.total.underOdds)}</div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-xs text-muted-foreground py-4">No total cached for this game.</div>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Page
// ═══════════════════════════════════════════════════════════════════
export default function PropTrends() {
  const [sport, setSport]       = useState<Sport>("WNBA");
  const [category, setCategory] = useState<Category>("player");

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight mb-0.5">Prop Trends</h1>
          <p className="text-muted-foreground text-sm">Sportsbook lines · player &amp; team markets · trend signals</p>
        </div>
      </div>

      {/* Category + sport */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Player / Team tabs */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button onClick={() => setCategory("player")}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold uppercase transition-colors ${category === "player" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
            <User className="w-3.5 h-3.5" /> Player
          </button>
          <button onClick={() => setCategory("team")}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold uppercase transition-colors ${category === "team" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
            <Users className="w-3.5 h-3.5" /> Team
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

      {category === "player" ? <PlayerTab sport={sport} /> : <TeamTab sport={sport} />}
    </div>
  );
}
