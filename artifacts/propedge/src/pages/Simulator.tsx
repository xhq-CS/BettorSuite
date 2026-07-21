import { useState, useMemo } from "react";
import {
  useGetSimulatorWallet, useResetSimulatorWallet,
  useListSimulatorBets, useCreateSimulatorBet, useSettleSimulatorBet,
  getGetSimulatorWalletQueryKey, getListSimulatorBetsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatOdds, calculatePayout } from "@/lib/utils";
import { toast } from "sonner";
import { Gamepad2, CheckCircle2, XCircle, X, Edit2, RotateCcw, Plus, Minus, CalendarDays, List } from "lucide-react";
import { format } from "date-fns";
import { BetCalendar } from "@/components/BetCalendar";

const BASE = (import.meta as any).env?.BASE_URL?.replace(/\/$/, "") ?? "";

// ── Wallet PATCH helper ───────────────────────────────────────────
async function patchWallet(action: "set" | "add" | "subtract", amount: number) {
  const r = await fetch(`${BASE}/api/simulator/wallet`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, amount }),
  });
  if (!r.ok) throw new Error("Failed to update wallet");
  return r.json();
}

// ── Modal shell ───────────────────────────────────────────────────
function Modal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm mx-4 bg-card border border-border rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-display font-semibold text-sm uppercase tracking-wider">{title}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────
export default function Simulator() {
  const qc = useQueryClient();

  const { data: wallet, isLoading: walletLoading } = useGetSimulatorWallet();
  const { data: bets,   isLoading: betsLoading   } = useListSimulatorBets();

  const createBet = useCreateSimulatorBet();
  const settleBet = useSettleSimulatorBet();
  const resetWallet = useResetSimulatorWallet();

  const [historyView, setHistoryView] = useState<"table" | "calendar">("table");

  // Modals
  const [editOpen,  setEditOpen]  = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  // Edit balance
  const [setBalanceVal, setSetBalanceVal] = useState("");
  const [adjustAmt,     setAdjustAmt]     = useState("");
  const [adjustDir,     setAdjustDir]     = useState<"add" | "subtract">("add");

  // Reset
  const [newStart, setNewStart] = useState("10000");

  // Bet form
  const [description, setDescription] = useState("");
  const [betType,     setBetType]      = useState("prop");
  const [wager,       setWager]        = useState("");
  const [odds,        setOdds]         = useState("");
  const [sport,       setSport]        = useState("NBA");

  const potentialPayoutPreview = calculatePayout(Number(wager), Number(odds));

  function invalidate() {
    qc.invalidateQueries({ queryKey: getGetSimulatorWalletQueryKey() });
    qc.invalidateQueries({ queryKey: getListSimulatorBetsQueryKey() });
  }

  // ── Quick add/subtract ──────────────────────────────────────────
  const quickAdjust = async (amount: number, dir: "add" | "subtract") => {
    try {
      await patchWallet(dir, amount);
      invalidate();
      toast.success(`${dir === "add" ? "Added" : "Removed"} ${formatCurrency(amount)}`);
    } catch { toast.error("Failed to update balance"); }
  };

  // ── Set balance ────────────────────────────────────────────────
  const handleSetBalance = async () => {
    const amount = parseFloat(setBalanceVal);
    if (isNaN(amount) || amount < 0) { toast.error("Enter a valid amount"); return; }
    try {
      await patchWallet("set", amount);
      invalidate();
      toast.success(`Balance set to ${formatCurrency(amount)}`);
      setEditOpen(false); setSetBalanceVal("");
    } catch { toast.error("Failed"); }
  };

  // ── Adjust balance ─────────────────────────────────────────────
  const handleAdjust = async () => {
    const amount = parseFloat(adjustAmt);
    if (isNaN(amount) || amount <= 0) { toast.error("Enter a valid amount"); return; }
    try {
      await patchWallet(adjustDir, amount);
      invalidate();
      toast.success(`${adjustDir === "add" ? "Added" : "Removed"} ${formatCurrency(amount)}`);
      setEditOpen(false); setAdjustAmt("");
    } catch { toast.error("Failed"); }
  };

  // ── Full reset ─────────────────────────────────────────────────
  const handleReset = () => {
    const amount = parseFloat(newStart);
    if (isNaN(amount) || amount <= 0) { toast.error("Enter a valid starting amount"); return; }
    resetWallet.mutate({ data: { startingBalance: amount } }, {
      onSuccess: () => { toast.success("Wallet reset"); invalidate(); setResetOpen(false); },
      onError:   () => toast.error("Reset failed"),
    });
  };

  // ── Place bet ──────────────────────────────────────────────────
  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !wager || !odds) { toast.error("Fill all required fields"); return; }
    if (wallet && Number(wager) > wallet.balance) { toast.error("Insufficient balance"); return; }
    createBet.mutate({ data: { description, betType, wager: Number(wager), odds: Number(odds), sport } }, {
      onSuccess: () => { toast.success("Bet placed!"); setDescription(""); setWager(""); setOdds(""); invalidate(); },
      onError:   () => toast.error("Failed to place bet"),
    });
  };

  const handleSettle = (id: number, status: "won" | "lost" | "push") => {
    settleBet.mutate({ id, data: { status } }, {
      onSuccess: () => { toast.success(`Marked ${status}`); invalidate(); },
    });
  };

  const winRate = wallet ? ((wallet.winRate ?? 0) * 100).toFixed(1) : "0.0";
  const roi     = wallet && wallet.totalBets > 0
    ? (((wallet.balance - wallet.startingBalance) / wallet.startingBalance) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight mb-0.5">Simulator</h1>
        <p className="text-muted-foreground text-sm">Test strategies risk-free with virtual money</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Left column ─────────────────────────── */}
        <div className="space-y-4">

          {/* Wallet card */}
          <Card className="border-border bg-card overflow-hidden">
            <CardContent className="p-5">
              {walletLoading ? (
                <div className="space-y-3 animate-pulse">
                  <div className="h-10 bg-muted rounded" />
                  <div className="h-4 bg-muted rounded w-2/3" />
                  <div className="h-16 bg-muted rounded" />
                </div>
              ) : (
                <>
                  {/* Balance */}
                  <div className="mb-4">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Sim Balance</div>
                    <div className="text-4xl font-mono font-bold tracking-tight">
                      {formatCurrency(wallet?.balance ?? 0)}
                    </div>
                    <div className={`text-sm font-mono mt-0.5 ${(wallet?.totalProfit ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {(wallet?.totalProfit ?? 0) >= 0 ? "+" : ""}{formatCurrency(wallet?.totalProfit ?? 0)} all time
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-4 gap-2 border-y border-border py-3 mb-4 text-center">
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase mb-0.5">W</div>
                      <div className="font-mono font-semibold text-green-400">{wallet?.wins ?? 0}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase mb-0.5">L</div>
                      <div className="font-mono font-semibold text-red-400">{wallet?.losses ?? 0}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase mb-0.5">W%</div>
                      <div className="font-mono font-semibold">{winRate}%</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase mb-0.5">ROI</div>
                      <div className={`font-mono font-semibold text-sm ${Number(roi) >= 0 ? "text-green-400" : "text-red-400"}`}>{Number(roi) >= 0 ? "+" : ""}{roi}%</div>
                    </div>
                  </div>

                  {/* Quick add */}
                  <div className="mb-3">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Quick Add</div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[100, 500, 1000, 5000].map(amt => (
                        <button
                          key={amt}
                          onClick={() => quickAdjust(amt, "add")}
                          className="py-1.5 text-[11px] font-mono font-semibold rounded border border-border hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-colors"
                        >
                          +{amt >= 1000 ? `${amt/1000}k` : amt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Edit & Reset */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditOpen(true)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold border border-border rounded-lg hover:bg-muted transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit Balance
                    </button>
                    <button
                      onClick={() => setResetOpen(true)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold border border-border rounded-lg hover:bg-destructive/10 hover:border-destructive/50 hover:text-destructive transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Reset
                    </button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Place Bet form */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3 pt-4">
              <CardTitle className="text-sm font-display uppercase tracking-wider flex items-center gap-2">
                <Gamepad2 className="w-4 h-4 text-primary" /> Place Sim Bet
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <form onSubmit={handleCreate} className="space-y-3">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-widest block mb-1">Description *</label>
                  <Input placeholder="e.g. Steph Curry O 5.5 3PM" value={description} onChange={e => setDescription(e.target.value)} className="bg-muted/30 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-widest block mb-1">Wager ($) *</label>
                    <Input type="number" step="0.01" placeholder="100" value={wager} onChange={e => setWager(e.target.value)} className="bg-muted/30 text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-widest block mb-1">Odds *</label>
                    <Input type="number" placeholder="-110" value={odds} onChange={e => setOdds(e.target.value)} className="bg-muted/30 text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-widest block mb-1">Sport</label>
                    <Select value={sport} onValueChange={setSport}>
                      <SelectTrigger className="bg-muted/30 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["NBA","WNBA","MLB","NFL"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-widest block mb-1">Type</label>
                    <Select value={betType} onValueChange={setBetType}>
                      <SelectTrigger className="bg-muted/30 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="prop">Prop</SelectItem>
                        <SelectItem value="moneyline">Moneyline</SelectItem>
                        <SelectItem value="spread">Spread</SelectItem>
                        <SelectItem value="total">Total</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {wager && odds && (
                  <div className="flex items-center justify-between bg-muted/30 border border-border rounded-lg px-3 py-2">
                    <span className="text-xs text-muted-foreground">To win</span>
                    <span className="font-mono font-semibold text-green-400 text-sm">{formatCurrency(potentialPayoutPreview)}</span>
                  </div>
                )}

                <Button type="submit" className="w-full text-sm" disabled={createBet.isPending || !wallet}>
                  {createBet.isPending ? "Placing…" : "Place Sim Bet →"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* ── Right column: History ───────────────── */}
        <div className="lg:col-span-2">
          <Card className="border-border bg-card h-full flex flex-col">
            <CardHeader className="pb-0 border-b border-border">
              <div className="flex items-center justify-between mb-3">
                <CardTitle className="text-sm font-display uppercase tracking-wider">Sim History</CardTitle>
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

            {historyView === "calendar" && (
              <CardContent className="pt-5 flex-1 overflow-auto">
                <BetCalendar bets={bets ?? []} label="Simulator" />
              </CardContent>
            )}

            {historyView === "table" && (
              <CardContent className="p-0 flex-1 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-5">Date</TableHead>
                      <TableHead>Play</TableHead>
                      <TableHead className="text-right">Risk / Win</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right pr-5">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {betsLoading ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                    ) : bets?.length ? (
                      bets.map(bet => (
                        <TableRow key={bet.id}>
                          <TableCell className="pl-5 text-muted-foreground text-xs whitespace-nowrap">{format(new Date(bet.createdAt), "MMM d")}</TableCell>
                          <TableCell>
                            <div className="font-medium text-sm">{bet.description}</div>
                            <div className="text-[10px] text-muted-foreground uppercase mt-0.5">{bet.sport} · {bet.betType}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="font-mono text-sm">{formatCurrency(bet.wager)} <span className="text-muted-foreground">@</span> {formatOdds(bet.odds)}</div>
                            <div className="font-mono text-xs text-green-400 mt-0.5">{formatCurrency(bet.potentialPayout)}</div>
                          </TableCell>
                          <TableCell className="text-center">
                            {bet.status === "pending" && <Badge variant="outline" className="text-xs">Pending</Badge>}
                            {bet.status === "won"     && <Badge variant="success"     className="text-xs">Won</Badge>}
                            {bet.status === "lost"    && <Badge variant="destructive" className="text-xs">Lost</Badge>}
                            {bet.status === "push"    && <Badge variant="outline"     className="text-xs">Push</Badge>}
                          </TableCell>
                          <TableCell className="text-right pr-5">
                            {bet.status === "pending" ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button onClick={() => handleSettle(bet.id, "won")} className="w-7 h-7 rounded bg-green-500/10 hover:bg-green-500/25 text-green-400 flex items-center justify-center transition-colors">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => handleSettle(bet.id, "lost")} className="w-7 h-7 rounded bg-destructive/10 hover:bg-destructive/25 text-destructive flex items-center justify-center transition-colors">
                                  <XCircle className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <span className={`font-mono text-xs font-semibold ${bet.actualPayout && bet.actualPayout > bet.wager ? "text-green-400" : "text-muted-foreground"}`}>
                                {bet.actualPayout != null ? formatCurrency(bet.actualPayout) : "–"}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow><TableCell colSpan={5} className="text-center py-16 text-muted-foreground text-sm">No simulator bets yet.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            )}
          </Card>
        </div>
      </div>

      {/* ── Edit Balance modal ────────────────────── */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Balance">
        <div className="space-y-4">
          {/* Set balance */}
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-widest block mb-1.5">Set Balance To</label>
            <div className="flex gap-2">
              <Input
                type="number" step="0.01" min="0"
                placeholder={formatCurrency(wallet?.balance ?? 0)}
                value={setBalanceVal}
                onChange={e => setSetBalanceVal(e.target.value)}
                className="bg-muted/30 font-mono"
              />
              <Button onClick={handleSetBalance} className="shrink-0">Set</Button>
            </div>
          </div>

          <div className="relative flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or adjust</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Add / subtract */}
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-widest block mb-1.5">Add / Remove Funds</label>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setAdjustDir("add")}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-semibold border rounded-lg transition-colors ${adjustDir === "add" ? "border-green-500 bg-green-500/10 text-green-400" : "border-border text-muted-foreground hover:bg-muted"}`}
              >
                <Plus className="w-3 h-3" /> Add
              </button>
              <button
                onClick={() => setAdjustDir("subtract")}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-semibold border rounded-lg transition-colors ${adjustDir === "subtract" ? "border-red-500 bg-red-500/10 text-red-400" : "border-border text-muted-foreground hover:bg-muted"}`}
              >
                <Minus className="w-3 h-3" /> Remove
              </button>
            </div>
            <div className="flex gap-2">
              <Input
                type="number" step="0.01" min="0.01"
                placeholder="Amount"
                value={adjustAmt}
                onChange={e => setAdjustAmt(e.target.value)}
                className="bg-muted/30 font-mono"
              />
              <Button onClick={handleAdjust} variant="outline" className="shrink-0">Apply</Button>
            </div>
            {/* Quick amounts */}
            <div className="flex gap-1.5 mt-2">
              {[100, 500, 1000, 5000].map(a => (
                <button key={a} onClick={() => setAdjustAmt(String(a))}
                  className="flex-1 py-1 text-[11px] font-mono border border-border rounded hover:bg-muted transition-colors">
                  {a >= 1000 ? `${a/1000}k` : a}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* ── Reset modal ───────────────────────────── */}
      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title="Reset Wallet">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will <span className="text-foreground font-medium">delete all sim bet history</span> and reset your balance to the starting amount.
          </p>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-widest block mb-1.5">Starting Balance</label>
            <Input
              type="number" step="100" min="100"
              value={newStart}
              onChange={e => setNewStart(e.target.value)}
              className="bg-muted/30 font-mono"
            />
            <div className="flex gap-1.5 mt-2">
              {[1000, 5000, 10000, 25000].map(a => (
                <button key={a} onClick={() => setNewStart(String(a))}
                  className={`flex-1 py-1 text-[11px] font-mono border rounded transition-colors ${newStart === String(a) ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}>
                  {a >= 1000 ? `${a/1000}k` : a}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={() => setResetOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleReset} variant="destructive" disabled={resetWallet.isPending} className="flex-1">
              {resetWallet.isPending ? "Resetting…" : "Reset Wallet"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
