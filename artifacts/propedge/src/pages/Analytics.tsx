import { useMemo } from "react";
import { useListBets } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from "recharts";
import { format, parseISO, startOfMonth } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, DollarSign, Target, Percent, Award } from "lucide-react";

export default function Analytics() {
  const { data: bets = [], isLoading } = useListBets({});

  const stats = useMemo(() => {
    if (!bets.length) return null;

    const settled   = bets.filter(b => b.status === "won" || b.status === "lost" || b.status === "push");
    const won       = bets.filter(b => b.status === "won");
    const lost      = bets.filter(b => b.status === "lost");
    const pending   = bets.filter(b => b.status === "pending");

    const totalWagered  = bets.reduce((s, b) => s + (b.wager ?? 0), 0);
    const totalReturned = won.reduce((s, b) => s + (b.actualPayout ?? b.potentialPayout ?? 0), 0);
    const totalProfit   = totalReturned - totalWagered;
    const roi           = totalWagered > 0 ? totalProfit / totalWagered : 0;
    const winRate       = settled.length > 0 ? won.length / settled.length : 0;
    const pendingWager  = pending.reduce((s, b) => s + (b.wager ?? 0), 0);
    const avgWager      = bets.length > 0 ? totalWagered / bets.length : 0;

    // Cumulative profit over time
    const sorted = [...bets]
      .filter(b => b.status !== "pending")
      .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
    let running = 0;
    const profitCurve = sorted.map(b => {
      const pnl = b.status === "won"
        ? (b.actualPayout ?? b.potentialPayout ?? 0) - (b.wager ?? 0)
        : b.status === "lost"
        ? -(b.wager ?? 0)
        : 0;
      running += pnl;
      return {
        date:       format(parseISO(b.createdAt), "MMM d"),
        cumProfit:  parseFloat(running.toFixed(2)),
        dailyPnl:   parseFloat(pnl.toFixed(2)),
      };
    });

    // Monthly breakdown
    const monthMap: Record<string, { wagered: number; profit: number; bets: number }> = {};
    sorted.forEach(b => {
      const key = format(startOfMonth(parseISO(b.createdAt)), "MMM yyyy");
      if (!monthMap[key]) monthMap[key] = { wagered: 0, profit: 0, bets: 0 };
      monthMap[key].wagered += b.wager ?? 0;
      const pnl = b.status === "won"
        ? (b.actualPayout ?? 0) - (b.wager ?? 0)
        : b.status === "lost"
        ? -(b.wager ?? 0)
        : 0;
      monthMap[key].profit += pnl;
      monthMap[key].bets   += 1;
    });
    const monthly = Object.entries(monthMap).map(([month, v]) => ({ month, ...v, profit: parseFloat(v.profit.toFixed(2)) }));

    // By sport
    const sportMap: Record<string, { wagered: number; profit: number; bets: number }> = {};
    settled.forEach(b => {
      const key = b.sport ?? "Other";
      if (!sportMap[key]) sportMap[key] = { wagered: 0, profit: 0, bets: 0 };
      sportMap[key].wagered += b.wager ?? 0;
      const pnl = b.status === "won"
        ? (b.actualPayout ?? 0) - (b.wager ?? 0)
        : b.status === "lost"
        ? -(b.wager ?? 0)
        : 0;
      sportMap[key].profit += pnl;
      sportMap[key].bets   += 1;
    });
    const bySport = Object.entries(sportMap).map(([sport, v]) => ({ sport, ...v, profit: parseFloat(v.profit.toFixed(2)) }));

    // By type
    const typeMap: Record<string, { wagered: number; bets: number; wins: number }> = {};
    bets.forEach(b => {
      const key = b.betType ?? "Other";
      if (!typeMap[key]) typeMap[key] = { wagered: 0, bets: 0, wins: 0 };
      typeMap[key].wagered += b.wager ?? 0;
      typeMap[key].bets    += 1;
      if (b.status === "won") typeMap[key].wins += 1;
    });
    const byType = Object.entries(typeMap).map(([type, v]) => ({
      type,
      bets: v.bets,
      wagered: v.wagered,
      winRate: v.bets > 0 ? v.wins / v.bets : 0,
    }));

    return {
      totalWagered, totalReturned, totalProfit, roi, winRate,
      pendingWager, avgWager,
      totalBets: bets.length,
      wins: won.length, losses: lost.length, pushes: bets.filter(b => b.status === "push").length,
      profitCurve, monthly, bySport, byType,
    };
  }, [bets]);

  const SPORT_COLORS: Record<string, string> = {
    NBA: "#3b82f6", WNBA: "#a855f7", MLB: "#22c55e", NFL: "#f59e0b", Other: "#64748b",
  };

  const SummaryCard = ({ icon: Icon, label, value, sub, color }: {
    icon: any; label: string; value: string; sub?: string; color?: string
  }) => (
    <Card className="border-border bg-card">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
          <Icon className={`w-4 h-4 ${color ?? "text-muted-foreground"}`} />
        </div>
        <div className={`text-2xl font-mono font-bold ${color ?? ""}`}>{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );

  if (isLoading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-48 bg-muted rounded" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{Array.from({length:8}).map((_,i)=><div key={i} className="h-24 bg-muted rounded-lg"/>)}</div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight mb-1">Analytics</h1>
        <p className="text-muted-foreground text-sm">Deep performance breakdown across all tracked bets</p>
      </div>

      {!stats ? (
        <div className="py-20 text-center text-muted-foreground">No bet data yet — log some bets in Bet Tracker to see analytics.</div>
      ) : (
        <>
          {/* Summary cards row 1 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard icon={DollarSign}   label="Total Wagered"   value={formatCurrency(stats.totalWagered)}  color="text-foreground" />
            <SummaryCard icon={DollarSign}   label="Total Returned"  value={formatCurrency(stats.totalReturned)} color="text-foreground" />
            <SummaryCard
              icon={TrendingUp} label="Net Profit / Loss"
              value={`${stats.totalProfit >= 0 ? "+" : ""}${formatCurrency(stats.totalProfit)}`}
              color={stats.totalProfit >= 0 ? "text-green-400" : "text-red-400"}
            />
            <SummaryCard
              icon={Percent} label="ROI"
              value={`${stats.roi >= 0 ? "+" : ""}${(stats.roi * 100).toFixed(1)}%`}
              color={stats.roi >= 0 ? "text-green-400" : "text-red-400"}
            />
          </div>

          {/* Summary cards row 2 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard icon={Target} label="Win Rate"      value={`${(stats.winRate * 100).toFixed(1)}%`} color={stats.winRate >= 0.5 ? "text-green-400" : "text-red-400"} sub={`${stats.wins}W · ${stats.losses}L · ${stats.pushes}P`} />
            <SummaryCard icon={Award}  label="Total Bets"    value={String(stats.totalBets)} sub={`${stats.wins} won`} />
            <SummaryCard icon={DollarSign} label="Avg Wager" value={formatCurrency(stats.avgWager)} />
            <SummaryCard icon={DollarSign} label="Pending Exposure" value={formatCurrency(stats.pendingWager)} color="text-amber-400" />
          </div>

          {/* Profit curve */}
          {stats.profitCurve.length > 1 && (
            <Card className="border-border bg-card">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Cumulative Profit</CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.profitCurve} margin={{ top: 5, right: 8, bottom: 0, left: -10 }}>
                      <defs>
                        <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={stats.totalProfit >= 0 ? "#22c55e" : "#ef4444"} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={stats.totalProfit >= 0 ? "#22c55e" : "#ef4444"} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="date" fontSize={10} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                      <YAxis fontSize={10} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false}
                        tickFormatter={v => `$${v}`} />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
                        formatter={(val: any) => [formatCurrency(val), "Cumulative P&L"]}
                      />
                      <Area type="monotone" dataKey="cumProfit" stroke={stats.totalProfit >= 0 ? "#22c55e" : "#ef4444"} strokeWidth={2} fill="url(#profitGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Monthly P&L */}
            {stats.monthly.length > 0 && (
              <Card className="border-border bg-card">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Monthly P&amp;L</CardTitle>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.monthly} margin={{ top: 5, right: 8, bottom: 0, left: -10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="month" fontSize={10} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                        <YAxis fontSize={10} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                        <Tooltip
                          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
                          formatter={(val: any) => [formatCurrency(val), "Profit"]}
                        />
                        <Bar dataKey="profit" radius={[3, 3, 0, 0]}>
                          {stats.monthly.map((m, i) => (
                            <Cell key={i} fill={m.profit >= 0 ? "#22c55e" : "#ef4444"} fillOpacity={0.8} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* By sport */}
            {stats.bySport.length > 0 && (
              <Card className="border-border bg-card">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">By Sport</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pb-4">
                  {stats.bySport.map(s => (
                    <div key={s.sport} className="flex items-center gap-3">
                      <Badge variant="outline" className="w-16 justify-center text-xs">{s.sport}</Badge>
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="text-muted-foreground">{s.bets} bets · {formatCurrency(s.wagered)} wagered</span>
                          <span className={s.profit >= 0 ? "text-green-400 font-mono font-semibold" : "text-red-400 font-mono font-semibold"}>
                            {s.profit >= 0 ? "+" : ""}{formatCurrency(s.profit)}
                          </span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${s.profit >= 0 ? "bg-green-400" : "bg-red-400"}`}
                            style={{ width: `${Math.min(100, Math.abs(s.profit) / (stats.totalWagered / 10) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* By bet type */}
          {stats.byType.length > 0 && (
            <Card className="border-border bg-card">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">By Bet Type</CardTitle>
              </CardHeader>
              <CardContent className="p-0 pb-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left pl-4 py-2 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Type</th>
                      <th className="text-center py-2 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Bets</th>
                      <th className="text-right py-2 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Wagered</th>
                      <th className="text-right pr-4 py-2 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Win Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byType.map(t => (
                      <tr key={t.type} className="border-b border-border/40">
                        <td className="pl-4 py-2.5 font-medium capitalize">{t.type}</td>
                        <td className="text-center py-2.5 font-mono">{t.bets}</td>
                        <td className="text-right py-2.5 font-mono">{formatCurrency(t.wagered)}</td>
                        <td className="text-right pr-4 py-2.5">
                          <span className={`font-mono font-semibold ${t.winRate >= 0.5 ? "text-green-400" : "text-red-400"}`}>
                            {(t.winRate * 100).toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
