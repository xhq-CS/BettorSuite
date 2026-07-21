import { useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, Search, ChevronRight, TrendingUp } from "lucide-react";

const BASE = (import.meta as any).env?.BASE_URL?.replace(/\/$/, "") ?? "";

// ── Prop categories ──────────────────────────────────────────────────────────
type Sport = "NBA" | "WNBA" | "MLB";

const SPORT_PROPS: Record<Sport, { key: string; label: string }[]> = {
  NBA: [
    { key: "points",        label: "Points"     },
    { key: "rebounds",      label: "Rebounds"   },
    { key: "assists",       label: "Assists"    },
    { key: "threePointers", label: "3-Pointers" },
    { key: "steals",        label: "Steals"     },
    { key: "blocks",        label: "Blocks"     },
    { key: "turnovers",     label: "Turnovers"  },
  ],
  WNBA: [
    { key: "points",        label: "Points"     },
    { key: "rebounds",      label: "Rebounds"   },
    { key: "assists",       label: "Assists"    },
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

type SortKey = "playerName" | "last5Avg" | "last10Avg" | "last20Avg" | "seasonAvg";

interface RankRow {
  playerId:   number;
  playerName: string;
  teamName:   string;
  position:   string;
  last5Avg:   number;
  last10Avg:  number;
  last20Avg:  number;
  seasonAvg:  number;
  gamesPlayed: number;
  high:       number;
  low:        number;
}

function avg(vals: number[]) {
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export default function PropTrends() {
  const [sport, setSport]   = useState<Sport>("NBA");
  const [prop, setProp]     = useState<string>("points");
  const [rows, setRows]     = useState<RankRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("last10Avg");
  const [sortAsc, setSortAsc] = useState(false);
  const [search, setSearch] = useState("");
  const [customLines, setCustomLines] = useState<Record<number, string>>({});

  const propDefs = SPORT_PROPS[sport];

  // Switch to first prop on sport change
  useEffect(() => {
    setProp(SPORT_PROPS[sport][0].key);
  }, [sport]);

  // Fetch prop rankings from backend
  useEffect(() => {
    setLoading(true);
    fetch(`${BASE}/api/players/prop-rankings?sport=${sport}&stat=${prop}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setRows(data);
        else setRows([]);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [sport, prop]);

  // Sort + filter
  const displayed = useMemo(() => {
    let list = [...rows];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r => r.playerName.toLowerCase().includes(q) || r.teamName.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      const av = sortKey === "playerName" ? a.playerName : a[sortKey];
      const bv = sortKey === "playerName" ? b.playerName : b[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return list;
  }, [rows, search, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(false); }
  }

  function hitRate(player: RankRow, line: number, window: "last5Avg" | "last10Avg" | "last20Avg" | "seasonAvg") {
    // Can't compute per-game hit rate from averages alone — show N/A
    return null;
  }

  const propLabel = propDefs.find(p => p.key === prop)?.label ?? prop;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight mb-1">Prop Trends</h1>
        <p className="text-muted-foreground text-sm">Browse player averages by stat — click any row for full trend analysis</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Sport */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          {(["NBA", "WNBA", "MLB"] as Sport[]).map(s => (
            <button
              key={s}
              onClick={() => setSport(s)}
              className={`px-4 py-1.5 text-xs font-semibold uppercase transition-colors ${
                sport === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Prop selector */}
        <div className="flex flex-wrap gap-1.5">
          {propDefs.map(p => (
            <button
              key={p.key}
              onClick={() => setProp(p.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                prop === p.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative ml-auto w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search players…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      {/* Table */}
      <Card className="border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left pl-4 pr-3 py-2.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                  <button onClick={() => toggleSort("playerName")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                    Player <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-left px-3 py-2.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Team</th>
                <th className="text-center px-3 py-2.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                  <button onClick={() => toggleSort("last5Avg")} className="flex items-center gap-1 mx-auto hover:text-foreground transition-colors">
                    L5 <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-center px-3 py-2.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                  <button onClick={() => toggleSort("last10Avg")} className="flex items-center gap-1 mx-auto hover:text-foreground transition-colors">
                    L10 <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-center px-3 py-2.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                  <button onClick={() => toggleSort("last20Avg")} className="flex items-center gap-1 mx-auto hover:text-foreground transition-colors">
                    L20 <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-center px-3 py-2.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                  <button onClick={() => toggleSort("seasonAvg")} className="flex items-center gap-1 mx-auto hover:text-foreground transition-colors">
                    Season <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-center px-3 py-2.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">High / Low</th>
                <th className="text-center px-3 py-2.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                  Custom Line
                </th>
                <th className="pr-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-3 py-3">
                        <div className="h-4 bg-muted animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : displayed.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-muted-foreground">
                    No players found{search ? ` matching "${search}"` : ""}.
                  </td>
                </tr>
              ) : displayed.map(row => {
                const line = customLines[row.playerId] ? parseFloat(customLines[row.playerId]) : null;
                const l10HitApprox = line != null
                  ? `${row.last10Avg > line ? "↑" : "↓"} ${row.last10Avg.toFixed(1)} vs ${line}`
                  : null;

                return (
                  <tr key={row.playerId} className="border-b border-border/40 hover:bg-muted/10 transition-colors group">
                    <td className="pl-4 pr-3 py-3">
                      <Link href={`/stats/players/${row.playerId}`}>
                        <div className="cursor-pointer">
                          <div className="font-semibold group-hover:text-primary transition-colors">{row.playerName}</div>
                          <div className="text-[10px] text-muted-foreground">{row.position}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant="outline" className="text-[10px]">{row.teamName}</Badge>
                    </td>
                    {/* Averages — color-code relative to season avg */}
                    {(["last5Avg", "last10Avg", "last20Avg", "seasonAvg"] as const).map(key => {
                      const val = row[key];
                      const isHot = key !== "seasonAvg" && val > row.seasonAvg * 1.1;
                      const isCold = key !== "seasonAvg" && val < row.seasonAvg * 0.9;
                      return (
                        <td key={key} className="px-3 py-3 text-center">
                          <span className={`font-mono font-semibold text-sm ${
                            isHot  ? "text-green-400" :
                            isCold ? "text-red-400"   : ""
                          }`}>{val.toFixed(1)}</span>
                        </td>
                      );
                    })}
                    <td className="px-3 py-3 text-center text-xs font-mono text-muted-foreground">
                      <span className="text-green-400">{row.high}</span> / <span className="text-red-400">{row.low}</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        placeholder="—"
                        value={customLines[row.playerId] ?? ""}
                        onChange={e => setCustomLines(prev => ({ ...prev, [row.playerId]: e.target.value }))}
                        onClick={e => e.stopPropagation()}
                        className="w-16 bg-muted/40 border border-border rounded px-2 py-0.5 text-xs font-mono text-center focus:outline-none focus:border-primary transition-colors"
                      />
                    </td>
                    <td className="pr-4 py-3">
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
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Green/red averages indicate performance above/below season average by 10%+. Click any player for full trend analysis with custom prop line.
      </p>
    </div>
  );
}
