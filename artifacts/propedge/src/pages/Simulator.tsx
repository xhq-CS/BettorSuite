import { useState } from "react";
import { useGetSimulatorWallet, useResetSimulatorWallet, useListSimulatorBets, useCreateSimulatorBet, useSettleSimulatorBet, getGetSimulatorWalletQueryKey, getListSimulatorBetsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatOdds, calculatePayout } from "@/lib/utils";
import { toast } from "sonner";
import { Wallet, RefreshCw, Trophy, Gamepad2, CheckCircle2, XCircle, CalendarDays, List } from "lucide-react";
import { format } from "date-fns";
import { BetCalendar } from "@/components/BetCalendar";

export default function Simulator() {
  const queryClient = useQueryClient();
  
  const { data: wallet, isLoading: walletLoading } = useGetSimulatorWallet();
  const { data: bets, isLoading: betsLoading } = useListSimulatorBets();
  
  const createBet = useCreateSimulatorBet();
  const settleBet = useSettleSimulatorBet();
  const resetWallet = useResetSimulatorWallet();

  const [historyView, setHistoryView] = useState<"table" | "calendar">("table");

  // Form State
  const [description, setDescription] = useState("");
  const [betType, setBetType] = useState("prop");
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

    if (wallet && Number(wager) > wallet.balance) {
      toast.error("Insufficient simulator balance");
      return;
    }

    createBet.mutate({
      data: {
        description,
        betType,
        wager: Number(wager),
        odds: Number(odds),
        sport,
      }
    }, {
      onSuccess: () => {
        toast.success("Simulator bet placed!");
        setDescription(""); setWager(""); setOdds("");
        queryClient.invalidateQueries({ queryKey: getListSimulatorBetsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetSimulatorWalletQueryKey() });
      },
      onError: () => toast.error("Failed to place simulator bet")
    });
  };

  const handleSettle = (id: number, status: 'won' | 'lost' | 'push') => {
    settleBet.mutate({
      id,
      data: { status }
    }, {
      onSuccess: () => {
        toast.success(`Bet marked as ${status}`);
        queryClient.invalidateQueries({ queryKey: getListSimulatorBetsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetSimulatorWalletQueryKey() });
      }
    });
  };

  const handleReset = () => {
    if (confirm("Reset your simulator wallet back to $10,000? All history will be kept, but balance resets.")) {
      resetWallet.mutate({
        data: { startingBalance: 10000 }
      }, {
        onSuccess: () => {
          toast.success("Wallet reset successfully");
          queryClient.invalidateQueries({ queryKey: getGetSimulatorWalletQueryKey() });
        }
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight mb-1">Simulator</h1>
        <p className="text-muted-foreground text-sm">Test strategies with virtual money</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card className="bg-card border-border relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none"></div>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-sm text-muted-foreground uppercase flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-primary" />
                  Sim Wallet
                </CardTitle>
                <button onClick={handleReset} className="text-muted-foreground hover:text-foreground transition-colors p-1" title="Reset Wallet">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {walletLoading ? (
                <div className="h-16 bg-muted animate-pulse rounded-md" />
              ) : (
                <>
                  <div className="text-5xl font-mono text-foreground font-bold tracking-tight mb-4">
                    {formatCurrency(wallet?.balance || 0)}
                  </div>
                  <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">P&L</p>
                      <p className={`font-mono font-bold ${wallet?.totalProfit && wallet.totalProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {wallet?.totalProfit && wallet.totalProfit >= 0 ? "+" : ""}{formatCurrency(wallet?.totalProfit || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">Win Rate</p>
                      <p className="font-mono font-bold text-foreground">{((wallet?.winRate ?? 0) * 100).toFixed(1)}%</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-display uppercase tracking-wider flex items-center gap-2">
                <Gamepad2 className="w-5 h-5 text-primary" />
                Place Sim Bet
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-mono uppercase text-muted-foreground">Description *</label>
                  <Input placeholder="e.g. Steph Curry O 5.5 3PM" value={description} onChange={e => setDescription(e.target.value)} className="bg-muted/50" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-mono uppercase text-muted-foreground">Wager ($) *</label>
                    <Input type="number" step="0.01" placeholder="100" value={wager} onChange={e => setWager(e.target.value)} className="bg-muted/50" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-mono uppercase text-muted-foreground">Odds *</label>
                    <Input type="number" placeholder="-110" value={odds} onChange={e => setOdds(e.target.value)} className="bg-muted/50" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-mono uppercase text-muted-foreground">Sport</label>
                    <Select value={sport} onValueChange={setSport}>
                      <SelectTrigger className="bg-muted/50"><SelectValue /></SelectTrigger>
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
                      <SelectTrigger className="bg-muted/50"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="prop">Player Prop</SelectItem>
                        <SelectItem value="moneyline">Moneyline</SelectItem>
                        <SelectItem value="spread">Spread</SelectItem>
                        <SelectItem value="total">Total</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {wager && odds && (
                  <div className="p-3 bg-muted/30 border border-border rounded-md mt-4 flex justify-between items-center">
                    <span className="text-xs font-mono uppercase text-muted-foreground">To Win</span>
                    <span className="font-mono font-bold text-green-400">{formatCurrency(potentialPayoutPreview)}</span>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={createBet.isPending || !wallet}>
                  {createBet.isPending ? "Placing..." : "Place Sim Bet"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-0 border-b border-border">
              <div className="flex items-center justify-between mb-4">
                <CardTitle className="text-lg font-display uppercase tracking-wider">Sim History</CardTitle>
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
            </CardHeader>

            {/* Calendar view */}
            {historyView === "calendar" && (
              <CardContent className="pt-5 flex-1 overflow-auto">
                <BetCalendar bets={bets ?? []} label="Simulator" />
              </CardContent>
            )}

            {/* Table view */}
            {historyView === "table" && (
            <CardContent className="p-0 flex-1 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Date</TableHead>
                    <TableHead>Play</TableHead>
                    <TableHead className="text-right">Risk/Reward</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right pr-6">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {betsLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8">Loading history...</TableCell></TableRow>
                  ) : bets?.length ? (
                    bets.map((bet) => (
                      <TableRow key={bet.id}>
                        <TableCell className="pl-6 text-muted-foreground whitespace-nowrap">{format(new Date(bet.createdAt), 'MMM d')}</TableCell>
                        <TableCell>
                          <div className="font-display font-medium text-foreground">{bet.description}</div>
                          <div className="text-[10px] text-muted-foreground uppercase mt-1">{bet.sport} • {bet.betType}</div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-mono text-sm">{formatCurrency(bet.wager)} @ {formatOdds(bet.odds)}</div>
                          <div className="font-mono text-xs text-green-400 mt-1">Win: {formatCurrency(bet.potentialPayout)}</div>
                        </TableCell>
                        <TableCell className="text-center">
                          {bet.status === 'pending' && <Badge variant="outline" className="bg-muted/50">Pending</Badge>}
                          {bet.status === 'won' && <Badge variant="success">Won</Badge>}
                          {bet.status === 'lost' && <Badge variant="destructive">Lost</Badge>}
                          {bet.status === 'push' && <Badge variant="outline">Push</Badge>}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          {bet.status === 'pending' ? (
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => handleSettle(bet.id, 'won')} className="w-8 h-8 rounded bg-green-500/10 hover:bg-green-500/20 text-green-400 flex items-center justify-center transition-colors">
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleSettle(bet.id, 'lost')} className="w-8 h-8 rounded bg-destructive/10 hover:bg-destructive/20 text-destructive flex items-center justify-center transition-colors">
                                <XCircle className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <span className={`text-xs font-mono font-bold ${bet.actualPayout && bet.actualPayout > bet.wager ? 'text-green-400' : 'text-muted-foreground'}`}>
                              {bet.actualPayout !== null ? formatCurrency(bet.actualPayout) : '-'}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground font-mono">No simulator bets yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
