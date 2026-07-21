import { useState, useMemo } from "react";
import { useListBets, useCreateBet, useUpdateBet, useGetBetSummary, getListBetsQueryKey, getGetBetSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatOdds, calculatePayout } from "@/lib/utils";
import { toast } from "sonner";
import { Trophy, TrendingUp, DollarSign, Target, Plus, CheckCircle2, XCircle, X, CalendarDays, List } from "lucide-react";
import { format } from "date-fns";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from "recharts";
import { BetCalendar } from "@/components/BetCalendar";

export default function BetTracker() {
  const queryClient = useQueryClient();
  const [filter, setFilter]       = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [historyView, setHistoryView] = useState<"table" | "calendar">("table");

  const { data: bets, isLoading: betsLoading } = useListBets(
    filter === "all" ? undefined : { status: filter as any }
  );

  const { data: summary, isLoading: summaryLoading } = useGetBetSummary();

  const createBet = useCreateBet();
  const updateBet = useUpdateBet();

  // Form State
  const [description, setDescription] = useState("");
  const [betType, setBetType] = useState("prop");
  const [sportsbook, setSportsbook] = useState("");
  const [wager, setWager] = useState("");
  const [odds, setOdds] = useState("");
  const [sport, setSport] = useState("NBA");

  const potentialPayoutPreview = calculatePayout(Number(wager), Number(odds));

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !wager || !odds) {
      toast.error("Please fill all required fields");
      return;
    }

    createBet.mutate({
      data: {
        description,
        betType,
        sportsbook,
        wager: Number(wager),
        odds: Number(odds),
        sport,
      }
    }, {
      onSuccess: () => {
        toast.success("Bet logged successfully");
        setDescription(""); setWager(""); setOdds(""); setSportsbook("");
        queryClient.invalidateQueries({ queryKey: getListBetsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetBetSummaryQueryKey() });
        setModalOpen(false);
      },
      onError: () => toast.error("Failed to log bet")
    });
  };

  const handleSettle = (id: number, status: 'won' | 'lost' | 'push') => {
    const bet = bets?.find(b => b.id === id);
    if (!bet) return;

    let actualPayout = 0;
    if (status === 'won') actualPayout = bet.potentialPayout || 0;
    if (status === 'push') actualPayout = bet.wager;

    updateBet.mutate({
      id,
      data: { status, actualPayout }
    }, {
      onSuccess: () => {
        toast.success(`Bet marked as ${status}`);
        queryClient.invalidateQueries({ queryKey: getListBetsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetBetSummaryQueryKey() });
      }
    });
  };

  const { chartData, pieData } = useMemo(() => {
    if (!bets) return { chartData: [], pieData: [] };

    const sorted = [...bets].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    let runningTotal = 0;
    const chartData = sorted.filter(b => b.status !== 'pending').map(bet => {
      if (bet.status === 'won') runningTotal += ((bet.potentialPayout || 0) - bet.wager);
      else if (bet.status === 'lost') runningTotal -= bet.wager;
      return { date: format(new Date(bet.createdAt), 'MMM d'), profit: runningTotal };
    });

    let won = 0, lost = 0, push = 0;
    bets.forEach(b => {
      if (b.status === 'won') won++;
      if (b.status === 'lost') lost++;
      if (b.status === 'push') push++;
    });

    const pieData = [
      { name: 'Won', value: won, color: '#22c55e' },
      { name: 'Lost', value: lost, color: '#ef4444' },
      { name: 'Push', value: push, color: '#555555' }
    ].filter(d => d.value > 0);

    return { chartData, pieData };
  }, [bets]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#111625] border border-[#1e2a3a] p-3 rounded shadow-xl">
          <p className="text-muted-foreground text-xs font-mono mb-1">{label}</p>
          <p className="font-mono font-bold text-sm" style={{ color: payload[0].payload.profit >= 0 ? '#22c55e' : '#ef4444' }}>
            {formatCurrency(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  const PieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#111625] border border-[#1e2a3a] p-3 rounded shadow-xl">
          <p className="font-mono font-bold text-sm text-foreground">
            {payload[0].name}: {payload[0].value}
          </p>
        </div>
      );
    }
    return null;
  };

  const winRatePct = ((summary?.winRate ?? 0) * 100).toFixed(1);
  const roiPct = ((summary?.roi ?? 0) * 100).toFixed(1);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tighter mb-2">BET TRACKER</h1>
          <p className="text-muted-foreground text-sm font-mono uppercase tracking-wider">Log & Analyze Your Action</p>
        </div>
        <Button
          onClick={() => setModalOpen(true)}
          className="font-display uppercase tracking-wider gap-2 h-10 px-5"
        >
          <Plus className="w-4 h-4" /> Log New Bet
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/40 border-border">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Win Rate</p>
                {summaryLoading
                  ? <div className="h-8 w-16 bg-muted animate-pulse rounded" />
                  : <p className="text-3xl font-mono font-bold text-green-400">{winRatePct}%</p>
                }
              </div>
              <Target className="w-4 h-4 text-muted-foreground opacity-50" />
            </div>
            <p className="text-xs font-mono text-muted-foreground mt-2">{summary?.wins}W - {summary?.losses}L - {summary?.pushes}P</p>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Net Profit</p>
                {summaryLoading
                  ? <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                  : <p className={`text-3xl font-mono font-bold ${(summary?.totalProfit ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {(summary?.totalProfit ?? 0) >= 0 ? "+" : ""}{formatCurrency(summary?.totalProfit || 0)}
                    </p>
                }
              </div>
              <DollarSign className="w-4 h-4 text-muted-foreground opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">ROI</p>
                {summaryLoading
                  ? <div className="h-8 w-20 bg-muted animate-pulse rounded" />
                  : <p className={`text-3xl font-mono font-bold ${Number(roiPct) >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {Number(roiPct) >= 0 ? "+" : ""}{roiPct}%
                    </p>
                }
              </div>
              <TrendingUp className="w-4 h-4 text-muted-foreground opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Wagered</p>
                {summaryLoading
                  ? <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                  : <p className="text-3xl font-mono font-bold text-foreground">{formatCurrency(summary?.totalWagered || 0)}</p>
                }
              </div>
              <Trophy className="w-4 h-4 text-muted-foreground opacity-50" />
            </div>
            <p className="text-xs font-mono text-muted-foreground mt-2">{summary?.totalBets} Total Bets</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card/40 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono uppercase text-muted-foreground tracking-wider">Profit Curve</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <div className="h-[220px] w-full">
              {!betsLoading && chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chartData[chartData.length - 1]?.profit >= 0 ? "#22c55e" : "#ef4444"} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={chartData[chartData.length - 1]?.profit >= 0 ? "#22c55e" : "#ef4444"} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#888' }} tickLine={false} axisLine={false} minTickGap={20} />
                    <YAxis tick={{ fontSize: 10, fill: '#888' }} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="profit"
                      stroke={chartData[chartData.length - 1]?.profit >= 0 ? "#22c55e" : "#ef4444"}
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorProfit)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs font-mono text-muted-foreground">
                  {betsLoading ? "Loading chart..." : "Not enough settled bets"}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono uppercase text-muted-foreground tracking-wider">Outcomes</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="h-[220px] w-full relative">
              {!betsLoading && pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={95}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                      label={({ name, percent }) => percent > 0.05 ? `${name}` : ''}
                      labelLine={false}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs font-mono text-muted-foreground">
                  {betsLoading ? "Loading chart..." : "No bets settled"}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bet History */}
      <Card className="bg-card/40 border-border">
        <CardHeader className="pb-0 border-b border-border">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <CardTitle className="text-sm font-display uppercase tracking-wider">Bet History</CardTitle>
              {/* Table / Calendar toggle */}
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => setHistoryView("table")}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold transition-colors ${historyView === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                >
                  <List className="w-3 h-3" /> Table
                </button>
                <button
                  onClick={() => setHistoryView("calendar")}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold transition-colors ${historyView === "calendar" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                >
                  <CalendarDays className="w-3 h-3" /> Calendar
                </button>
              </div>
            </div>
            {historyView === "table" && (
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-[150px] h-8 text-xs font-mono bg-transparent">
                  <SelectValue placeholder="Filter Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Bets</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="won">Won</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>

        {/* Calendar view */}
        {historyView === "calendar" && (
          <CardContent className="pt-5">
            <BetCalendar bets={bets ?? []} label="Tracker" />
          </CardContent>
        )}

        {/* Table view */}
        {historyView === "table" && (
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Book</TableHead>
                <TableHead className="text-right">Wager</TableHead>
                <TableHead className="text-right">Odds</TableHead>
                <TableHead className="text-right">To Win</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right pr-6">Settle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {betsLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8">Loading bets...</TableCell></TableRow>
              ) : bets?.length ? (
                bets.map((bet) => (
                  <TableRow key={bet.id}>
                    <TableCell className="pl-6 text-muted-foreground whitespace-nowrap text-sm">{format(new Date(bet.createdAt), 'MMM d, yy')}</TableCell>
                    <TableCell>
                      <div className="font-display font-medium text-foreground">{bet.description}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[9px] py-0 h-4">{bet.sport}</Badge>
                        <span className="text-[10px] text-muted-foreground uppercase">{bet.betType}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs uppercase">{bet.sportsbook || '-'}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatCurrency(bet.wager)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatOdds(bet.odds)}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-green-400">{formatCurrency(bet.potentialPayout || 0)}</TableCell>
                    <TableCell className="text-center">
                      {bet.status === 'pending' && <Badge variant="outline" className="bg-muted/50">Pending</Badge>}
                      {bet.status === 'won' && <Badge variant="success">Won</Badge>}
                      {bet.status === 'lost' && <Badge variant="destructive">Lost</Badge>}
                      {bet.status === 'push' && <Badge variant="outline">Push</Badge>}
                    </TableCell>
                    <TableCell className="text-right pr-6 min-w-[100px]">
                      {bet.status === 'pending' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => handleSettle(bet.id, 'won')} className="w-7 h-7 rounded bg-green-500/10 hover:bg-green-500/20 text-green-400 flex items-center justify-center transition-colors" title="Mark Won">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleSettle(bet.id, 'lost')} className="w-7 h-7 rounded bg-destructive/10 hover:bg-destructive/20 text-destructive flex items-center justify-center transition-colors" title="Mark Lost">
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleSettle(bet.id, 'push')} className="w-7 h-7 rounded bg-muted hover:bg-muted/80 text-muted-foreground flex items-center justify-center transition-colors font-mono text-[10px] font-bold" title="Mark Push">
                            P
                          </button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground font-mono">No bets found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        )}
      </Card>

      {/* Log New Bet Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}
        >
          <div className="w-full max-w-md mx-4 bg-card border border-border rounded-xl shadow-xl animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="flex items-center gap-2 text-lg font-display uppercase tracking-wider">
                <Plus className="w-5 h-5 text-primary" /> Log New Bet
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreate} className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-mono uppercase text-muted-foreground">Description *</label>
                <Input placeholder="e.g. LeBron James O 25.5 PTS" value={description} onChange={e => setDescription(e.target.value)} className="bg-background/50" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-mono uppercase text-muted-foreground">Wager ($) *</label>
                  <Input type="number" step="0.01" placeholder="100" value={wager} onChange={e => setWager(e.target.value)} className="bg-background/50" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-mono uppercase text-muted-foreground">American Odds *</label>
                  <Input type="number" placeholder="-110" value={odds} onChange={e => setOdds(e.target.value)} className="bg-background/50" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-mono uppercase text-muted-foreground">Sport</label>
                  <Select value={sport} onValueChange={setSport}>
                    <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NBA">NBA</SelectItem>
                      <SelectItem value="WNBA">WNBA</SelectItem>
                      <SelectItem value="MLB">MLB</SelectItem>
                      <SelectItem value="NFL">NFL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-mono uppercase text-muted-foreground">Type</label>
                  <Select value={betType} onValueChange={setBetType}>
                    <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prop">Player Prop</SelectItem>
                      <SelectItem value="moneyline">Moneyline</SelectItem>
                      <SelectItem value="spread">Spread</SelectItem>
                      <SelectItem value="total">Total</SelectItem>
                      <SelectItem value="parlay">Parlay</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-mono uppercase text-muted-foreground">Sportsbook</label>
                <Input placeholder="e.g. DraftKings" value={sportsbook} onChange={e => setSportsbook(e.target.value)} className="bg-background/50" />
              </div>

              {wager && odds && (
                <div className="p-3 bg-muted/40 rounded-md border border-border flex justify-between items-center">
                  <span className="text-xs font-mono uppercase text-muted-foreground">Potential Payout</span>
                  <span className="font-mono font-bold text-lg text-green-400">{formatCurrency(potentialPayoutPreview)}</span>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <Button type="button" variant="outline" className="flex-1 font-display uppercase tracking-wider" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 font-display uppercase tracking-wider" disabled={createBet.isPending}>
                  {createBet.isPending ? "Logging..." : "Log Bet →"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
