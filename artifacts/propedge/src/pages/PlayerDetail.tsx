import { useState, useMemo } from "react";
import { useRoute, Link } from "wouter";
import { useGetPlayer, useGetPlayerStats, useGetPlayerPropSummary, getGetPlayerStatsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Info } from "lucide-react";
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import { format } from "date-fns";

// ── Prop definitions ─────────────────────────────────────────────────────────
interface PropDef { key: string; label: string; short: string }

const BASKETBALL_PROPS: PropDef[] = [
  { key: "points",        label: "Points",     short: "PTS" },
  { key: "rebounds",      label: "Rebounds",   short: "REB" },
  { key: "assists",       label: "Assists",    short: "AST" },
  { key: "threePointers", label: "3-Pointers", short: "3PM" },
  { key: "steals",        label: "Steals",     short: "STL" },
  { key: "blocks",        label: "Blocks",     short: "BLK" },
  { key: "turnovers",     label: "Turnovers",  short: "TO"  },
];

const BASEBALL_PROPS: PropDef[] = [
  { key: "hits",       label: "Hits",       short: "H"   },
  { key: "homeRuns",   label: "Home Runs",  short: "HR"  },
  { key: "rbis",       label: "RBIs",       short: "RBI" },
  { key: "runs",       label: "Runs",       short: "R"   },
  { key: "strikeouts", label: "Strikeouts", short: "SO"  },
  { key: "walks",      label: "Walks",      short: "BB"  },
];

type GameFilter = 5 | 10 | 20 | "all";

// ── Helpers ──────────────────────────────────────────────────────────────────
function avg(vals: number[]): number {
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}
function hitRate(vals: number[], line: number): number {
  if (!vals.length) return 0;
  return vals.filter(v => v > line).length / vals.length;
}

// ── Custom tooltip ───────────────────────────────────────────────────────────
function BarTooltip({ active, payload, label, propLine }: any) {
  if (!active || !payload?.length) return null;
  const val    = payload[0].value;
  const result = propLine != null
    ? val > propLine ? "OVER ✓" : val < propLine ? "UNDER ✗" : "PUSH ≈"
    : null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-xl text-sm min-w-[130px]">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      <p className="font-mono text-2xl font-bold text-foreground">{val}</p>
      {result && (
        <p className={`text-xs mt-1 font-semibold ${
          result.startsWith("OVER") ? "text-green-400" :
          result.startsWith("UNDER") ? "text-red-400" : "text-amber-400"
        }`}>{result}</p>
      )}
      {propLine != null && <p className="text-xs text-muted-foreground mt-0.5">Line: {propLine}</p>}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function PlayerDetail() {
  const [, params] = useRoute("/stats/players/:id");
  const playerId = parseInt(params?.id || "0");

  const [selectedStat, setSelectedStat] = useState<string>("points");
  const [gameFilter, setGameFilter]     = useState<GameFilter>(10);
  const [propLineRaw, setPropLineRaw]   = useState("");

  const propLine = propLineRaw.trim() !== "" ? parseFloat(propLineRaw) : null;

  const { data: player, isLoading: playerLoading } = useGetPlayer(playerId, {
    query: { enabled: !!playerId, queryKey: ["getPlayer", playerId] },
  });
  const { data: stats } = useGetPlayerStats(playerId, "season", {
    query: { enabled: !!playerId, queryKey: getGetPlayerStatsQueryKey(playerId, "season") },
  });

  const isBasketball = player?.sport === "NBA" || player?.sport === "WNBA";
  const isBaseball   = player?.sport === "MLB";
  const props        = isBasketball ? BASKETBALL_PROPS : BASEBALL_PROPS;

  // Ensure selected stat is valid for the sport
  const activeProp = props.find(p => p.key === selectedStat) ?? props[0];

  // All stats, sorted oldest→newest (API returns ASC, so just reverse to get newest→oldest,
  // but we keep oldest→newest for the chart)
  const allStats: number[] = useMemo(() => {
    if (!stats) return [];
    return stats.map(s => (s as any)[activeProp.key] ?? 0);
  }, [stats, activeProp.key]);

  // Apply game filter — take the LAST N games (most recent N, but keep oldest→newest order for chart)
  const filteredStats = useMemo(() => {
    if (!stats) return [];
    const n = gameFilter === "all" ? stats.length : gameFilter;
    return stats.slice(-n);
  }, [stats, gameFilter]);

  const filteredValues: number[] = filteredStats.map(s => (s as any)[activeProp.key] ?? 0);

  // Averages for different windows (computed from all season data)
  const rangeStats = useMemo(() => {
    const ranges: { label: string; n: number | "all" }[] = [
      { label: "L5",  n: 5  },
      { label: "L10", n: 10 },
      { label: "L20", n: 20 },
      { label: "Season", n: "all" },
    ];
    return ranges.map(({ label, n }) => {
      const slice = n === "all" ? allStats : allStats.slice(-n as number);
      const a     = avg(slice);
      const hr    = propLine != null ? hitRate(slice, propLine) : null;
      const hi    = slice.length ? Math.max(...slice) : 0;
      const lo    = slice.length ? Math.min(...slice) : 0;
      return { label, count: slice.length, avg: a, hitRate: hr, high: hi, low: lo };
    });
  }, [allStats, propLine]);

  const currentAvg     = avg(filteredValues);
  const currentHitRate = propLine != null ? hitRate(filteredValues, propLine) : null;
  const currentHigh    = filteredValues.length ? Math.max(...filteredValues) : 0;
  const currentLow     = filteredValues.length ? Math.min(...filteredValues) : 0;

  // Chart data: oldest → newest (left → right)
  const chartData = filteredStats.map(s => ({
    date:  format(new Date(s.gameDate), "MMM d"),
    opp:   s.opponent,
    value: (s as any)[activeProp.key] ?? 0,
  }));

  // Game log: newest → oldest
  const gameLog = [...filteredStats].reverse();

  // Nearby lines (±0.5, ±1 around prop line)
  const nearbyLines = propLine != null ? [
    propLine - 1,
    propLine - 0.5,
    propLine,
    propLine + 0.5,
    propLine + 1,
  ].filter(l => l >= 0) : [];

  // Insight summary
  const insight = useMemo(() => {
    if (filteredValues.length === 0 || !player) return null;
    const n    = filteredValues.length;
    const a    = currentAvg.toFixed(1);
    const hi   = currentHigh;
    const lo   = currentLow;
    const stat = activeProp.label.toLowerCase();

    if (propLine != null && currentHitRate != null) {
      const over  = filteredValues.filter(v => v > propLine).length;
      const pct   = Math.round(currentHitRate * 100);
      return `${player.name} has gone over ${propLine} ${stat} in ${over} of their last ${n} games (${pct}%), averaging ${a} ${stat} in that span.`;
    }
    return `${player.name} averaged ${a} ${stat} over their last ${n} games, ranging from a low of ${lo} to a high of ${hi}.`;
  }, [filteredValues, player, propLine, currentHitRate, currentAvg, currentHigh, currentLow, activeProp]);

  if (playerLoading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-24 bg-muted rounded-lg" />
      <div className="h-12 bg-muted rounded-lg" />
      <div className="h-72 bg-muted rounded-lg" />
    </div>
  );
  if (!player) return <div className="text-muted-foreground">Player not found.</div>;

  const FILTERS: { label: string; value: GameFilter }[] = [
    { label: "L5",  value: 5   },
    { label: "L10", value: 10  },
    { label: "L20", value: 20  },
    { label: "All", value: "all" },
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-300 max-w-5xl">
      {/* Back */}
      <Link href="/stats">
        <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Live Stats
        </div>
      </Link>

      {/* Player header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="text-3xl font-display font-bold tracking-tight">{player.name}</h1>
            {player.number && <span className="text-xl font-mono text-muted-foreground">#{player.number}</span>}
          </div>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            <Link href={`/stats/teams/${player.teamId}`}>
              <span className="hover:text-primary transition-colors cursor-pointer">{player.teamName}</span>
            </Link>
            <span>·</span>
            <span>{player.position}</span>
            <span>·</span>
            <Badge variant="outline" className="text-xs">{player.sport}</Badge>
          </div>
        </div>
      </div>

      {/* ── Stat selector ─────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {props.map(p => (
          <button
            key={p.key}
            onClick={() => { setSelectedStat(p.key); }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
              selectedStat === p.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
            }`}
          >
            {p.short}
          </button>
        ))}
      </div>

      {/* ── Time filter + summary cards ───────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex rounded-lg border border-border overflow-hidden">
          {FILTERS.map(f => (
            <button
              key={f.label}
              onClick={() => setGameFilter(f.value)}
              className={`px-4 py-1.5 text-xs font-semibold transition-colors ${
                gameFilter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="text-center">
            <div className="font-mono font-bold text-xl">{currentAvg.toFixed(1)}</div>
            <div className="text-[10px] text-muted-foreground uppercase">Avg</div>
          </div>
          {currentHitRate != null && (
            <div className="text-center">
              <div className={`font-mono font-bold text-xl ${currentHitRate >= 0.6 ? "text-green-400" : currentHitRate >= 0.4 ? "text-amber-400" : "text-red-400"}`}>
                {Math.round(currentHitRate * 100)}%
              </div>
              <div className="text-[10px] text-muted-foreground uppercase">Hit Rate</div>
            </div>
          )}
          <div className="text-center">
            <div className="font-mono font-bold text-xl text-green-400">{currentHigh}</div>
            <div className="text-[10px] text-muted-foreground uppercase">High</div>
          </div>
          <div className="text-center">
            <div className="font-mono font-bold text-xl text-red-400">{currentLow}</div>
            <div className="text-[10px] text-muted-foreground uppercase">Low</div>
          </div>
        </div>
      </div>

      {/* ── Bar chart ─────────────────────────────────── */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2 pt-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              {activeProp.label} · Last {gameFilter === "all" ? filteredStats.length : gameFilter} games
            </CardTitle>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-400 inline-block" /> Over</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" /> Under</span>
              {propLine == null && <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-primary inline-block" /> Value</span>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="h-56">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data for this period</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 8, bottom: 0, left: -20 }} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="date"
                    fontSize={10}
                    fontFamily="var(--font-mono)"
                    stroke="hsl(var(--muted-foreground))"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    fontSize={10}
                    fontFamily="var(--font-mono)"
                    stroke="hsl(var(--muted-foreground))"
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<BarTooltip propLine={propLine} />} cursor={{ fill: "hsl(var(--muted)/0.3)" }} />
                  {/* Prop line */}
                  {propLine != null && (
                    <ReferenceLine
                      y={propLine}
                      stroke="#f59e0b"
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      label={{ value: `Line ${propLine}`, position: "insideTopRight", fontSize: 10, fill: "#f59e0b" }}
                    />
                  )}
                  {/* Average line */}
                  <ReferenceLine
                    y={parseFloat(currentAvg.toFixed(1))}
                    stroke="hsl(var(--primary))"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    label={{ value: `Avg ${currentAvg.toFixed(1)}`, position: "insideBottomRight", fontSize: 10, fill: "hsl(var(--primary))" }}
                  />
                  <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={
                          propLine == null
                            ? "hsl(var(--primary))"
                            : entry.value > propLine
                            ? "#22c55e"
                            : entry.value < propLine
                            ? "#ef4444"
                            : "#f59e0b"
                        }
                        fillOpacity={0.85}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Custom prop line + hit rate ───────────────── */}
      <Card className="border-border bg-card">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Custom Prop Line</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="e.g. 24.5"
                  value={propLineRaw}
                  onChange={e => setPropLineRaw(e.target.value)}
                  className="w-28 bg-muted/40 border border-border rounded-md px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-primary transition-colors"
                />
                {propLineRaw && (
                  <button onClick={() => setPropLineRaw("")} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
                )}
              </div>
            </div>

            {propLine != null && filteredValues.length > 0 && (
              <>
                <div className="flex gap-6">
                  {(["over", "under", "push"] as const).map(type => {
                    const count = filteredValues.filter(v =>
                      type === "over"  ? v > propLine :
                      type === "under" ? v < propLine : v === propLine
                    ).length;
                    return (
                      <div key={type} className="text-center">
                        <div className={`font-mono font-bold text-lg ${type === "over" ? "text-green-400" : type === "under" ? "text-red-400" : "text-amber-400"}`}>
                          {count}
                        </div>
                        <div className="text-[10px] text-muted-foreground uppercase">{type}</div>
                      </div>
                    );
                  })}
                  <div className="text-center">
                    <div className={`font-mono font-bold text-lg ${currentHitRate! >= 0.6 ? "text-green-400" : "text-muted-foreground"}`}>
                      {Math.round(currentHitRate! * 100)}%
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase">Hit Rate</div>
                  </div>
                </div>

                {/* Nearby lines */}
                {nearbyLines.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Nearby Lines</div>
                    <div className="flex gap-2 flex-wrap">
                      {nearbyLines.map(line => {
                        const over = filteredValues.filter(v => v > line).length;
                        const pct  = Math.round((over / filteredValues.length) * 100);
                        const isActive = line === propLine;
                        return (
                          <button
                            key={line}
                            onClick={() => setPropLineRaw(String(line))}
                            className={`flex flex-col items-center px-3 py-1 rounded border text-xs transition-colors ${
                              isActive ? "border-amber-400 bg-amber-400/10" : "border-border hover:border-primary/50"
                            }`}
                          >
                            <span className="font-mono font-semibold">{line}</span>
                            <span className={`font-mono ${pct >= 60 ? "text-green-400" : pct <= 40 ? "text-red-400" : "text-amber-400"}`}>{pct}%</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Comparison table ──────────────────────────── */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {activeProp.label} Comparison
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Range</TableHead>
                <TableHead className="text-center">Games</TableHead>
                <TableHead className="text-center">Avg</TableHead>
                {propLine != null && <TableHead className="text-center">Over</TableHead>}
                {propLine != null && <TableHead className="text-center">Hit %</TableHead>}
                <TableHead className="text-center">High</TableHead>
                <TableHead className="text-right pr-4">Low</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rangeStats.map(r => (
                <TableRow key={r.label}>
                  <TableCell className="pl-4 font-semibold text-sm">{r.label}</TableCell>
                  <TableCell className="text-center font-mono text-sm">{r.count}</TableCell>
                  <TableCell className="text-center font-mono font-semibold">{r.avg.toFixed(1)}</TableCell>
                  {propLine != null && (
                    <TableCell className="text-center font-mono">
                      {r.hitRate != null ? Math.round(r.hitRate * r.count) : "–"}
                    </TableCell>
                  )}
                  {propLine != null && (
                    <TableCell className="text-center">
                      {r.hitRate != null ? (
                        <span className={`font-mono font-semibold ${r.hitRate >= 0.6 ? "text-green-400" : r.hitRate >= 0.4 ? "text-amber-400" : "text-red-400"}`}>
                          {Math.round(r.hitRate * 100)}%
                        </span>
                      ) : "–"}
                    </TableCell>
                  )}
                  <TableCell className="text-center font-mono text-green-400">{r.high}</TableCell>
                  <TableCell className="text-right pr-4 font-mono text-red-400">{r.low}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Insight summary ───────────────────────────── */}
      {insight && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
          <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <p className="text-sm text-foreground leading-relaxed">{insight}</p>
        </div>
      )}

      {/* ── Game log ──────────────────────────────────── */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2 pt-4 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Game Log — Recent First
          </CardTitle>
          <span className="text-xs text-muted-foreground">{gameLog.length} games</span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Date</TableHead>
                  <TableHead>Opp</TableHead>
                  {isBasketball && (
                    <>
                      <TableHead className="text-right">MIN</TableHead>
                      <TableHead className="text-right">PTS</TableHead>
                      <TableHead className="text-right">REB</TableHead>
                      <TableHead className="text-right">AST</TableHead>
                      <TableHead className="text-right">3PM</TableHead>
                      <TableHead className="text-right">STL</TableHead>
                      <TableHead className="text-right">BLK</TableHead>
                    </>
                  )}
                  {isBaseball && (
                    <>
                      <TableHead className="text-right">H</TableHead>
                      <TableHead className="text-right">HR</TableHead>
                      <TableHead className="text-right">RBI</TableHead>
                      <TableHead className="text-right">R</TableHead>
                      <TableHead className="text-right">SO</TableHead>
                      <TableHead className="text-right">BB</TableHead>
                    </>
                  )}
                  {propLine != null && <TableHead className="text-right pr-4">Result</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {gameLog.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">No games in this period</TableCell>
                  </TableRow>
                ) : gameLog.map(stat => {
                  const statVal = (stat as any)[activeProp.key] ?? null;
                  const isOver  = propLine != null && statVal != null && statVal > propLine;
                  const isUnder = propLine != null && statVal != null && statVal < propLine;
                  return (
                    <TableRow key={stat.id} className="hover:bg-muted/10">
                      <TableCell className="pl-4 text-sm">{format(new Date(stat.gameDate), "MMM d, yy")}</TableCell>
                      <TableCell className="font-mono text-sm">{stat.opponent}</TableCell>
                      {isBasketball && (
                        <>
                          <TableCell className="text-right text-muted-foreground text-sm">{stat.minutesPlayed ?? "–"}</TableCell>
                          <TableCell className={`text-right font-semibold text-sm ${selectedStat === "points"        ? (isOver ? "text-green-400" : isUnder ? "text-red-400" : "") : ""}`}>{stat.points ?? "–"}</TableCell>
                          <TableCell className={`text-right font-semibold text-sm ${selectedStat === "rebounds"      ? (isOver ? "text-green-400" : isUnder ? "text-red-400" : "") : ""}`}>{stat.rebounds ?? "–"}</TableCell>
                          <TableCell className={`text-right font-semibold text-sm ${selectedStat === "assists"       ? (isOver ? "text-green-400" : isUnder ? "text-red-400" : "") : ""}`}>{stat.assists ?? "–"}</TableCell>
                          <TableCell className={`text-right text-sm          ${selectedStat === "threePointers"  ? (isOver ? "text-green-400" : isUnder ? "text-red-400" : "") : ""}`}>{stat.threePointers ?? "–"}</TableCell>
                          <TableCell className={`text-right text-sm          ${selectedStat === "steals"         ? (isOver ? "text-green-400" : isUnder ? "text-red-400" : "") : ""}`}>{stat.steals ?? "–"}</TableCell>
                          <TableCell className={`text-right text-sm          ${selectedStat === "blocks"         ? (isOver ? "text-green-400" : isUnder ? "text-red-400" : "") : ""}`}>{stat.blocks ?? "–"}</TableCell>
                        </>
                      )}
                      {isBaseball && (
                        <>
                          <TableCell className={`text-right font-semibold text-sm ${selectedStat === "hits"       ? (isOver ? "text-green-400" : isUnder ? "text-red-400" : "") : ""}`}>{stat.hits ?? "–"}</TableCell>
                          <TableCell className={`text-right text-sm          ${selectedStat === "homeRuns"   ? (isOver ? "text-green-400" : isUnder ? "text-red-400" : "") : ""}`}>{stat.homeRuns ?? "–"}</TableCell>
                          <TableCell className={`text-right text-sm          ${selectedStat === "rbis"       ? (isOver ? "text-green-400" : isUnder ? "text-red-400" : "") : ""}`}>{stat.rbis ?? "–"}</TableCell>
                          <TableCell className={`text-right text-sm          ${selectedStat === "runs"       ? (isOver ? "text-green-400" : isUnder ? "text-red-400" : "") : ""}`}>{stat.runs ?? "–"}</TableCell>
                          <TableCell className={`text-right text-sm          ${selectedStat === "strikeouts" ? (isOver ? "text-green-400" : isUnder ? "text-red-400" : "") : ""}`}>{stat.strikeouts ?? "–"}</TableCell>
                          <TableCell className={`text-right text-sm          ${selectedStat === "walks"      ? (isOver ? "text-green-400" : isUnder ? "text-red-400" : "") : ""}`}>{stat.walks ?? "–"}</TableCell>
                        </>
                      )}
                      {propLine != null && (
                        <TableCell className="text-right pr-4">
                          <span className={`text-xs font-semibold font-mono ${isOver ? "text-green-400" : isUnder ? "text-red-400" : "text-amber-400"}`}>
                            {isOver ? "OVER" : isUnder ? "UNDER" : "PUSH"}
                          </span>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
