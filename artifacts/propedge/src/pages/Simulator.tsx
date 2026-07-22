import { useState, useMemo, useEffect } from "react";
import {
  useGetSimulatorWallet,
  useResetSimulatorWallet,
  useListSimulatorBets,
  useCreateSimulatorBet,
  useSettleSimulatorBet,
  getGetSimulatorWalletQueryKey,
  getListSimulatorBetsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatCurrency,
  formatOdds,
  calculatePayout,
  calculateParlayOdds,
} from "@/lib/utils";
import { api } from "@/lib/api";
import { BET_TYPE_OPTIONS, formatBetType } from "@/lib/betting-options";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  X,
  Edit2,
  RotateCcw,
  Plus,
  Minus,
  MinusCircle,
  CalendarDays,
  List,
  Trash2,
  Share2,
} from "lucide-react";
import { format } from "date-fns";
import { BetCalendar } from "@/components/BetCalendar";
import { ProfitBoostControl } from "@/components/ProfitBoostControl";
import { ProfitBoostBadge } from "@/components/ProfitBoostBadge";
import {
  ParlayLegEditor,
  createParlayLegs,
  toParlayDrafts,
  validParlayLegs,
  type ParlayLegDraft,
} from "@/components/ParlayLegEditor";
import { BetModeToggle } from "@/components/BetModeToggle";
import { ParlayLegsSummary } from "@/components/ParlayLegsSummary";
import {
  ShareBetDialog,
  type ShareableBet,
} from "@/components/shared-bets/ShareBetDialog";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  HistoryStatusFilter,
  type HistoryStatusFilterValue,
} from "@/components/HistoryStatusFilter";

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

async function patchUnitSettings(
  unitMode: "auto" | "custom",
  customUnitSize?: number,
) {
  const r = await fetch(`${BASE}/api/simulator/wallet`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ unitMode, customUnitSize }),
  });
  if (!r.ok) throw new Error("Failed to update unit size");
  return r.json();
}

function formatUnits(value: number, unitSize: number, showSign = true) {
  const units = unitSize > 0 ? value / unitSize : 0;
  return `${showSign && units > 0 ? "+" : ""}${units.toFixed(2)}u`;
}

// ── Modal shell ───────────────────────────────────────────────────
function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        className={`max-h-[92vh] w-full ${wide ? "max-w-2xl" : "max-w-sm"} mx-4 overflow-y-auto bg-card border border-border rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-display font-semibold text-lg">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="w-7 h-7 rounded flex items-center justify-center text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────
export default function Simulator() {
  const qc = useQueryClient();

  const { data: wallet, isLoading: walletLoading } = useGetSimulatorWallet();
  const { data: bets, isLoading: betsLoading } = useListSimulatorBets();
  const betList = Array.isArray(bets) ? bets : [];

  const createBet = useCreateSimulatorBet();
  const settleBet = useSettleSimulatorBet();
  const resetWallet = useResetSimulatorWallet();

  const [historyView, setHistoryView] = useState<"table" | "calendar">("table");
  const [historyFilter, setHistoryFilter] =
    useState<HistoryStatusFilterValue>("all");
  const historyBets =
    historyFilter === "all"
      ? betList
      : betList.filter((bet) => bet.status === historyFilter);
  const [profitDisplay, setProfitDisplay] = useState<"money" | "units">(
    "money",
  );
  const [unitModeDraft, setUnitModeDraft] = useState<"auto" | "custom">("auto");
  const [customUnitInput, setCustomUnitInput] = useState("");
  const [unitsBusy, setUnitsBusy] = useState(false);

  // Modals
  const [editOpen, setEditOpen] = useState(false);
  const [unitOpen, setUnitOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [configureOpen, setConfigureOpen] = useState(false);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [configuredBetId, setConfiguredBetId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [shareBet, setShareBet] = useState<ShareableBet | null>(null);

  // Edit balance
  const [setBalanceVal, setSetBalanceVal] = useState("");
  const [adjustAmt, setAdjustAmt] = useState("");
  const [adjustDir, setAdjustDir] = useState<"add" | "subtract">("add");

  // Reset
  const [newStart, setNewStart] = useState("10000");

  // Bet form
  const [description, setDescription] = useState("");
  const [betType, setBetType] = useState("prop");
  const [wager, setWager] = useState("");
  const [odds, setOdds] = useState("");
  const [profitBoost, setProfitBoost] = useState("");
  const [sport, setSport] = useState("NBA");
  const [betMode, setBetMode] = useState<"straight" | "parlay">("straight");
  const [parlayLegs, setParlayLegs] =
    useState<ParlayLegDraft[]>(createParlayLegs);
  const [createAttempted, setCreateAttempted] = useState(false);

  // Configure an existing mock bet
  const [configuredDescription, setConfiguredDescription] = useState("");
  const [configuredType, setConfiguredType] = useState("prop");
  const [configuredWager, setConfiguredWager] = useState("");
  const [configuredOdds, setConfiguredOdds] = useState("");
  const [configuredProfitBoost, setConfiguredProfitBoost] = useState("");
  const [configuredSport, setConfiguredSport] = useState("NBA");
  const [configuredStatus, setConfiguredStatus] = useState<
    "pending" | "won" | "lost" | "push"
  >("pending");
  const [configuredMode, setConfiguredMode] = useState<"straight" | "parlay">(
    "straight",
  );
  const [configuredParlayLegs, setConfiguredParlayLegs] =
    useState<ParlayLegDraft[]>(createParlayLegs);
  const [configureAttempted, setConfigureAttempted] = useState(false);
  const [configureBusy, setConfigureBusy] = useState(false);

  const effectiveOdds =
    betMode === "parlay" ? calculateParlayOdds(parlayLegs) : Number(odds);
  const descriptionInvalid =
    createAttempted && betMode === "straight" && !description.trim();
  const wagerExceedsWallet =
    createAttempted &&
    Boolean(wallet) &&
    Number.isFinite(Number(wager)) &&
    Number(wager) > Number(wallet?.balance ?? 0);
  const wagerInvalid =
    createAttempted &&
    (!wager ||
      !Number.isFinite(Number(wager)) ||
      Number(wager) <= 0 ||
      wagerExceedsWallet);
  const oddsInvalid =
    createAttempted &&
    betMode === "straight" &&
    (!odds || !Number.isFinite(Number(odds)) || Number(odds) === 0);
  const configuredDescriptionInvalid =
    configureAttempted && !configuredDescription.trim();
  const configuredWagerInvalid =
    configureAttempted &&
    (!configuredWager ||
      !Number.isFinite(Number(configuredWager)) ||
      Number(configuredWager) <= 0);
  const configuredOddsInvalid =
    configureAttempted &&
    configuredMode === "straight" &&
    (!configuredOdds ||
      !Number.isFinite(Number(configuredOdds)) ||
      Number(configuredOdds) === 0);
  const potentialPayoutPreview = calculatePayout(
    Number(wager),
    effectiveOdds,
    Number(profitBoost || 0),
  );

  useEffect(() => {
    if (!wallet) return;
    setUnitModeDraft(wallet.unitMode);
    setCustomUnitInput(String(wallet.customUnitSize));
  }, [wallet?.unitMode, wallet?.customUnitSize]);

  function invalidate() {
    qc.invalidateQueries({ queryKey: getGetSimulatorWalletQueryKey() });
    qc.invalidateQueries({ queryKey: getListSimulatorBetsQueryKey() });
  }

  // ── Quick add/subtract ──────────────────────────────────────────
  const quickAdjust = async (amount: number, dir: "add" | "subtract") => {
    try {
      await patchWallet(dir, amount);
      invalidate();
      toast.success(
        `${dir === "add" ? "Added" : "Removed"} ${formatCurrency(amount)}`,
      );
    } catch {
      toast.error("Failed to update balance");
    }
  };

  // ── Set balance ────────────────────────────────────────────────
  const handleSetBalance = async () => {
    const amount = parseFloat(setBalanceVal);
    if (isNaN(amount) || amount < 0) {
      toast.error("Enter a valid amount");
      return;
    }
    try {
      await patchWallet("set", amount);
      invalidate();
      toast.success(`Balance set to ${formatCurrency(amount)}`);
      setEditOpen(false);
      setSetBalanceVal("");
    } catch {
      toast.error("Failed");
    }
  };

  // ── Adjust balance ─────────────────────────────────────────────
  const handleAdjust = async () => {
    const amount = parseFloat(adjustAmt);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    try {
      await patchWallet(adjustDir, amount);
      invalidate();
      toast.success(
        `${adjustDir === "add" ? "Added" : "Removed"} ${formatCurrency(amount)}`,
      );
      setEditOpen(false);
      setAdjustAmt("");
    } catch {
      toast.error("Failed");
    }
  };

  // ── Full reset ─────────────────────────────────────────────────
  const handleReset = () => {
    const amount = parseFloat(newStart);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid starting amount");
      return;
    }
    resetWallet.mutate(
      { data: { startingBalance: amount } },
      {
        onSuccess: () => {
          toast.success("Wallet reset");
          invalidate();
          setResetOpen(false);
        },
        onError: () => toast.error("Reset failed"),
      },
    );
  };

  // ── Place bet ──────────────────────────────────────────────────
  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateAttempted(true);
    const normalizedLegs =
      betMode === "parlay" ? validParlayLegs(parlayLegs) : [];
    if (
      !Number.isFinite(Number(wager)) ||
      Number(wager) <= 0 ||
      (betMode === "straight" &&
        (!description.trim() ||
          !Number.isFinite(Number(odds)) ||
          Number(odds) === 0)) ||
      (betMode === "parlay" && !normalizedLegs)
    ) {
      toast.error("Fill all required fields");
      return;
    }
    if (wallet && Number(wager) > wallet.balance) {
      toast.error("Insufficient balance");
      return;
    }
    createBet.mutate(
      {
        data: {
          description:
            betMode === "parlay"
              ? `${normalizedLegs!.length}-Leg Parlay`
              : description,
          betType: betMode === "parlay" ? "parlay" : betType,
          wager: Number(wager),
          odds: effectiveOdds,
          parlayLegs: betMode === "parlay" ? normalizedLegs! : undefined,
          profitBoostPercent: Number(profitBoost || 0),
          sport,
        },
      },
      {
        onSuccess: () => {
          toast.success("Bet placed!");
          setDescription("");
          setWager("");
          setOdds("");
          setProfitBoost("");
          setBetMode("straight");
          setParlayLegs(createParlayLegs());
          setCreateAttempted(false);
          setPlaceOpen(false);
          invalidate();
        },
        onError: (error) =>
          toast.error(
            error instanceof Error ? error.message : "Failed to place bet",
          ),
      },
    );
  };

  const handleSettle = (id: number, status: "won" | "lost" | "push") => {
    settleBet.mutate(
      { id, data: { status } },
      {
        onSuccess: () => {
          toast.success(`Marked ${status}`);
          invalidate();
        },
      },
    );
  };

  const openConfigure = (bet: any) => {
    setConfigureAttempted(false);
    setConfiguredBetId(bet.id);
    setConfiguredDescription(bet.description);
    setConfiguredType(bet.betType);
    setConfiguredWager(String(bet.wager));
    setConfiguredOdds(String(bet.odds));
    setConfiguredProfitBoost(
      Number(bet.profitBoostPercent) > 0 ? String(bet.profitBoostPercent) : "",
    );
    setConfiguredSport(bet.sport ?? "NBA");
    setConfiguredStatus(bet.status);
    setConfiguredMode(
      bet.betType === "parlay" || bet.parlayLegs?.length
        ? "parlay"
        : "straight",
    );
    setConfiguredParlayLegs(toParlayDrafts(bet.parlayLegs));
    setDeleteConfirm(false);
    setConfigureOpen(true);
  };

  const handleConfigureSave = async () => {
    setConfigureAttempted(true);
    const normalizedLegs =
      configuredMode === "parlay" ? validParlayLegs(configuredParlayLegs) : [];
    if (
      !configuredBetId ||
      !configuredDescription.trim() ||
      Number(configuredWager) <= 0 ||
      (configuredMode === "straight" && !Number(configuredOdds)) ||
      (configuredMode === "parlay" && !normalizedLegs)
    ) {
      toast.error("Enter valid bet details");
      return;
    }
    setConfigureBusy(true);
    try {
      await api(`/simulator/bets/${configuredBetId}`, {
        method: "PATCH",
        body: JSON.stringify({
          description: configuredDescription.trim(),
          betType: configuredMode === "parlay" ? "parlay" : configuredType,
          wager: Number(configuredWager),
          odds:
            configuredMode === "parlay"
              ? calculateParlayOdds(configuredParlayLegs)
              : Number(configuredOdds),
          parlayLegs: normalizedLegs,
          profitBoostPercent: Number(configuredProfitBoost || 0),
          sport: configuredSport,
          status: configuredStatus,
        }),
      });
      toast.success("Mock bet updated");
      setConfigureAttempted(false);
      setConfigureOpen(false);
      invalidate();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to update bet",
      );
    } finally {
      setConfigureBusy(false);
    }
  };

  const handleDeleteBet = async () => {
    if (!configuredBetId) return;
    setConfigureBusy(true);
    try {
      await api(`/simulator/bets/${configuredBetId}`, { method: "DELETE" });
      toast.success("Mock bet removed");
      setConfigureOpen(false);
      invalidate();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to remove bet",
      );
    } finally {
      setConfigureBusy(false);
    }
  };

  const handleSaveUnits = async () => {
    const customSize = Number(customUnitInput);
    if (
      unitModeDraft === "custom" &&
      (!Number.isFinite(customSize) || customSize <= 0)
    ) {
      toast.error("Enter a valid unit size");
      return;
    }
    setUnitsBusy(true);
    try {
      await patchUnitSettings(
        unitModeDraft,
        unitModeDraft === "custom" ? customSize : undefined,
      );
      invalidate();
      setUnitOpen(false);
      toast.success(
        unitModeDraft === "auto"
          ? "Unit size set to 1% of your starting bankroll"
          : `Unit size set to ${formatCurrency(customSize)}`,
      );
    } catch {
      toast.error("Unable to update unit size");
    } finally {
      setUnitsBusy(false);
    }
  };

  const winRate = wallet ? ((wallet.winRate ?? 0) * 100).toFixed(1) : "0.0";
  const roi =
    wallet && wallet.totalBets > 0
      ? (((wallet.totalProfit ?? 0) / wallet.startingBalance) * 100).toFixed(1)
      : "0.0";
  const unitSize = Math.max(0.01, Number(wallet?.unitSize ?? 1));

  const chartData = useMemo(() => {
    let cumulative = 0;
    const settled = [...betList]
      .reverse()
      .filter((bet) => bet.status !== "pending");
    return [
      { date: "Start", profit: 0, units: 0 },
      ...settled.map((bet) => {
        if (bet.status === "won")
          cumulative += (bet.actualPayout ?? bet.potentialPayout) - bet.wager;
        else if (bet.status === "lost") cumulative -= bet.wager;
        return {
          date: format(new Date(bet.createdAt), "MMM d"),
          profit: Number(cumulative.toFixed(2)),
          units: Number((cumulative / unitSize).toFixed(2)),
        };
      }),
    ];
  }, [betList, unitSize]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tighter mb-1">
            MOCK BETTING
          </h1>
          <p className="text-muted-foreground text-sm font-mono uppercase tracking-wider">
            Test your strategy with a virtual bankroll
          </p>
        </div>
        <Button
          type="button"
          onClick={() => {
            setCreateAttempted(false);
            setPlaceOpen(true);
          }}
          className="gap-2 font-display uppercase tracking-wider"
        >
          <Plus className="h-4 w-4" /> Place Mock Bet
        </Button>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
        {/* ── Left column ─────────────────────────── */}
        <div className="space-y-6 lg:contents lg:space-y-0">
          {/* Wallet card */}
          <Card className="h-full border-border bg-card overflow-hidden shadow-sm lg:col-start-1">
            <CardContent className="p-4">
              {walletLoading ? (
                <div className="space-y-3 animate-pulse">
                  <div className="h-10 bg-muted rounded" />
                  <div className="h-4 bg-muted rounded w-2/3" />
                  <div className="h-16 bg-muted rounded" />
                </div>
              ) : (
                <>
                  {/* Balance */}
                  <div className="mb-3">
                    <div className="text-sm font-medium text-muted-foreground mb-1">
                      Virtual Bankroll
                    </div>
                    <div className="text-3xl font-mono font-bold tracking-tight text-slate-950">
                      {formatCurrency(wallet?.balance ?? 0)}
                    </div>
                    <div
                      className={`text-base font-mono font-semibold mt-1 ${(wallet?.totalProfit ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}
                    >
                      {(wallet?.totalProfit ?? 0) >= 0 ? "+" : ""}
                      {formatCurrency(wallet?.totalProfit ?? 0)}
                      <span className="mx-2 text-slate-300">|</span>
                      {formatUnits(wallet?.totalProfit ?? 0, unitSize)} Total
                      Profit
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-4 gap-1.5 border-y border-border py-2.5 mb-3">
                    <div className="rounded-lg bg-slate-50 px-2.5 py-1.5">
                      <div className="text-xs font-medium text-muted-foreground mb-0.5">
                        Wins
                      </div>
                      <div className="font-mono text-xl font-bold text-green-400">
                        {wallet?.wins ?? 0}
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-2.5 py-1.5">
                      <div className="text-xs font-medium text-muted-foreground mb-0.5">
                        Losses
                      </div>
                      <div className="font-mono text-xl font-bold text-red-600">
                        {wallet?.losses ?? 0}
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-2.5 py-1.5">
                      <div className="text-xs font-medium text-muted-foreground mb-0.5">
                        Win Rate
                      </div>
                      <div className="font-mono text-xl font-bold text-slate-900">
                        {winRate}%
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-2.5 py-1.5">
                      <div className="text-xs font-medium text-muted-foreground mb-0.5">
                        ROI
                      </div>
                      <div
                        className={`font-mono text-xl font-bold ${Number(roi) >= 0 ? "text-green-400" : "text-red-400"}`}
                      >
                        {Number(roi) >= 0 ? "+" : ""}
                        {roi}%
                      </div>
                    </div>
                  </div>

                  {/* Unit size */}
                  <div className="mb-2.5 flex items-center justify-between gap-3 rounded-lg border border-border bg-slate-50 px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-muted-foreground">
                        Unit Size
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="whitespace-nowrap font-mono text-base font-bold text-emerald-700">
                          1u = {formatCurrency(unitSize)}
                        </span>
                        <span className="truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          {wallet?.unitMode === "custom"
                            ? "Custom"
                            : "Auto · 1%"}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setUnitModeDraft(wallet?.unitMode ?? "auto");
                        setCustomUnitInput(
                          String(wallet?.customUnitSize ?? unitSize),
                        );
                        setUnitOpen(true);
                      }}
                      className="shrink-0 rounded-md border border-border bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-primary/40 hover:text-primary"
                    >
                      Configure
                    </button>
                  </div>

                  {/* Quick add */}
                  <div className="mb-2.5">
                    <div className="text-sm font-medium text-slate-700 mb-1.5">
                      Quick Add Funds
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[100, 500, 1000, 5000].map((amt) => (
                        <button
                          key={amt}
                          onClick={() => quickAdjust(amt, "add")}
                          className="py-1.5 text-sm font-mono font-semibold rounded-lg border border-border hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-colors"
                        >
                          +{amt >= 1000 ? `${amt / 1000}k` : amt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Edit & Reset */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditOpen(true)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-semibold border border-border rounded-lg hover:bg-muted transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit Balance
                    </button>
                    <button
                      onClick={() => setResetOpen(true)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold border border-border rounded-lg hover:bg-destructive/10 hover:border-destructive/50 hover:text-destructive transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Reset
                    </button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Right column: History ───────────────── */}
        <div className="min-w-0 space-y-6 lg:contents lg:space-y-0">
          <Card className="h-full border-border bg-card shadow-sm lg:col-start-2">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-display">
                    Profit Trend
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Cumulative profit from settled mock bets
                  </p>
                </div>
                <div
                  className="flex overflow-hidden rounded-lg border border-border"
                  aria-label="Profit graph display"
                >
                  <button
                    type="button"
                    onClick={() => setProfitDisplay("money")}
                    className={`min-w-10 px-3 py-1.5 text-sm font-mono font-bold transition-colors ${profitDisplay === "money" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                  >
                    $
                  </button>
                  <button
                    type="button"
                    onClick={() => setProfitDisplay("units")}
                    className={`min-w-10 border-l border-border px-3 py-1.5 text-sm font-mono font-bold transition-colors ${profitDisplay === "units" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                  >
                    Units
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="h-[170px] w-full">
                {chartData.length > 1 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 10, right: 12, left: 4, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="mockProfitFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#2563eb"
                            stopOpacity={0.22}
                          />
                          <stop
                            offset="95%"
                            stopColor="#2563eb"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#e2e8f0"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12, fill: "#64748b" }}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={24}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: "#64748b" }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) =>
                          profitDisplay === "money" ? `$${value}` : `${value}u`
                        }
                        width={62}
                      />
                      <ChartTooltip
                        formatter={(value: number) => [
                          profitDisplay === "money"
                            ? formatCurrency(value)
                            : `${Number(value).toFixed(2)}u`,
                          "Profit",
                        ]}
                        contentStyle={{
                          borderRadius: 10,
                          border: "1px solid #e2e8f0",
                          boxShadow: "0 8px 24px rgba(15,23,42,.08)",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey={profitDisplay === "money" ? "profit" : "units"}
                        stroke="#2563eb"
                        strokeWidth={2.5}
                        fill="url(#mockProfitFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                    Settle a mock bet to begin your profit graph.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card flex flex-col shadow-sm lg:col-span-2 min-w-0">
            <CardHeader className="pb-0 border-b border-border">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-lg font-display">
                    Bet History
                  </CardTitle>
                  <div className="flex overflow-hidden rounded-lg border border-border">
                    <button
                      onClick={() => setHistoryView("table")}
                      className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold transition-colors ${historyView === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                    >
                      <List className="w-3 h-3" /> Table
                    </button>
                    <button
                      onClick={() => setHistoryView("calendar")}
                      className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold transition-colors ${historyView === "calendar" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                    >
                      <CalendarDays className="w-3 h-3" /> Calendar
                    </button>
                  </div>
                </div>
                <HistoryStatusFilter
                  value={historyFilter}
                  onValueChange={setHistoryFilter}
                />
              </div>
            </CardHeader>

            {historyView === "calendar" && (
              <CardContent className="pt-5 flex-1 overflow-auto">
                <BetCalendar
                  bets={historyBets}
                  label="Mock Betting"
                  showDayDetails
                />
              </CardContent>
            )}

            {historyView === "table" && (
              <CardContent className="p-0 flex-1 overflow-hidden">
                <Table className="hidden xl:table w-full table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[9%] pl-4 text-xs font-semibold">
                        Date
                      </TableHead>
                      <TableHead className="w-[22%] text-xs font-semibold">
                        Bet
                      </TableHead>
                      <TableHead className="w-[8%] text-right text-xs font-semibold">
                        Odds
                      </TableHead>
                      <TableHead className="w-[9%] text-right text-xs font-semibold">
                        Wager
                      </TableHead>
                      <TableHead className="w-[10%] text-right text-xs font-semibold">
                        Payout
                      </TableHead>
                      <TableHead className="w-[14%] text-right text-xs font-semibold">
                        Profit / Units
                      </TableHead>
                      <TableHead className="w-[10%] text-center text-xs font-semibold">
                        Status
                      </TableHead>
                      <TableHead className="w-[18%] text-right pr-4 text-xs font-semibold">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {betsLoading ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="text-center py-8 text-muted-foreground"
                        >
                          Loading…
                        </TableCell>
                      </TableRow>
                    ) : historyBets.length ? (
                      historyBets.map((bet) => {
                        const winnings =
                          bet.status === "won"
                            ? (bet.actualPayout ?? bet.potentialPayout) -
                              bet.wager
                            : bet.status === "lost"
                              ? -bet.wager
                              : bet.status === "pending"
                                ? bet.potentialPayout - bet.wager
                                : 0;
                        const totalPayout =
                          bet.status === "pending"
                            ? bet.potentialPayout
                            : bet.actualPayout;
                        return (
                          <TableRow
                            key={bet.id}
                            className={
                              Number(bet.profitBoostPercent) > 0
                                ? "bg-amber-50/70 hover:bg-amber-50"
                                : undefined
                            }
                          >
                            <TableCell className="pl-4 text-slate-600 text-xs font-medium whitespace-nowrap">
                              {format(new Date(bet.createdAt), "MMM d")}
                            </TableCell>
                            <TableCell className="pr-2">
                              <div
                                className="font-display font-semibold text-sm text-slate-900 truncate"
                                title={bet.description}
                              >
                                {bet.description}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                <span>
                                  {bet.sport} · {formatBetType(bet.betType)}
                                </span>
                                <ProfitBoostBadge
                                  percent={bet.profitBoostPercent}
                                />
                              </div>
                              <ParlayLegsSummary
                                legs={bet.parlayLegs}
                                isParlay={bet.betType === "parlay"}
                                status={bet.status}
                              />
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm text-slate-800 whitespace-nowrap">
                              {formatOdds(bet.odds)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm font-semibold text-slate-900 whitespace-nowrap">
                              {formatCurrency(bet.wager)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm font-semibold text-slate-900 whitespace-nowrap">
                              {totalPayout == null
                                ? "—"
                                : formatCurrency(totalPayout)}
                              {bet.status === "pending" && (
                                <div className="text-[9px] font-sans font-normal text-muted-foreground">
                                  Potential
                                </div>
                              )}
                            </TableCell>
                            <TableCell
                              className={`text-right font-mono text-[13px] font-semibold whitespace-nowrap ${winnings > 0 ? "text-green-400" : winnings < 0 ? "text-red-400" : "text-slate-600"}`}
                            >
                              <div className="flex items-center justify-end gap-1.5">
                                <span>
                                  {winnings > 0 ? "+" : ""}
                                  {formatCurrency(winnings)}
                                </span>
                                <span className="text-slate-300">/</span>
                                <span>{formatUnits(winnings, unitSize)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              {bet.status === "pending" && (
                                <Badge
                                  variant="outline"
                                  className="min-w-[64px] justify-center text-sm px-2.5 py-0.5"
                                >
                                  Pending
                                </Badge>
                              )}
                              {bet.status === "won" && (
                                <Badge
                                  variant="success"
                                  className="min-w-[64px] justify-center text-sm px-2.5 py-0.5"
                                >
                                  Won
                                </Badge>
                              )}
                              {bet.status === "lost" && (
                                <Badge
                                  variant="destructive"
                                  className="min-w-[64px] justify-center text-sm px-2.5 py-0.5"
                                >
                                  Lost
                                </Badge>
                              )}
                              {bet.status === "push" && (
                                <Badge
                                  variant="outline"
                                  className="min-w-[64px] justify-center text-sm px-2.5 py-0.5"
                                >
                                  Push
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right pr-4">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  aria-label="Mark bet as won"
                                  title="Mark won"
                                  disabled={
                                    settleBet.isPending || bet.status === "won"
                                  }
                                  onClick={() => handleSettle(bet.id, "won")}
                                  className="w-[30px] h-[30px] rounded-md bg-green-500/10 hover:bg-green-500/20 text-green-400 disabled:opacity-35 flex items-center justify-center transition-colors"
                                >
                                  <CheckCircle2 className="w-[15px] h-[15px]" />
                                </button>
                                <button
                                  aria-label="Mark bet as lost"
                                  title="Mark lost"
                                  disabled={
                                    settleBet.isPending || bet.status === "lost"
                                  }
                                  onClick={() => handleSettle(bet.id, "lost")}
                                  className="w-[30px] h-[30px] rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-400 disabled:opacity-35 flex items-center justify-center transition-colors"
                                >
                                  <XCircle className="w-[15px] h-[15px]" />
                                </button>
                                <button
                                  aria-label="Mark bet as push"
                                  title="Mark push"
                                  disabled={
                                    settleBet.isPending || bet.status === "push"
                                  }
                                  onClick={() => handleSettle(bet.id, "push")}
                                  className="w-[30px] h-[30px] rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 disabled:opacity-35 flex items-center justify-center transition-colors"
                                >
                                  <MinusCircle className="w-[15px] h-[15px]" />
                                </button>
                                <button
                                  aria-label="Share mock bet"
                                  title="Share bet"
                                  onClick={() => setShareBet(bet)}
                                  className="flex h-[30px] w-[30px] items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-600 transition-colors hover:bg-blue-100"
                                >
                                  <Share2 className="h-[15px] w-[15px]" />
                                </button>
                                <button
                                  aria-label="Configure mock bet"
                                  title="Configure bet"
                                  onClick={() => openConfigure(bet)}
                                  className="w-[30px] h-[30px] rounded-md border border-border hover:bg-muted text-slate-600 flex items-center justify-center transition-colors"
                                >
                                  <Edit2 className="w-[15px] h-[15px]" />
                                </button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="text-center py-16 text-muted-foreground text-sm"
                        >
                          {historyFilter === "all"
                            ? "No mock bets yet."
                            : "No bets match this result."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                <div className="xl:hidden divide-y divide-border">
                  {betsLoading ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      Loading…
                    </div>
                  ) : historyBets.length ? (
                    historyBets.map((bet) => {
                      const winnings =
                        bet.status === "won"
                          ? (bet.actualPayout ?? bet.potentialPayout) -
                            bet.wager
                          : bet.status === "lost"
                            ? -bet.wager
                            : bet.status === "pending"
                              ? bet.potentialPayout - bet.wager
                              : 0;
                      const totalPayout =
                        bet.status === "pending"
                          ? bet.potentialPayout
                          : bet.actualPayout;
                      return (
                        <div
                          key={bet.id}
                          className={`p-4 space-y-3 ${Number(bet.profitBoostPercent) > 0 ? "bg-amber-50/70" : ""}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-display font-semibold text-slate-900">
                                {bet.description}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-1.5">
                                <span>
                                  {format(new Date(bet.createdAt), "MMM d")} ·{" "}
                                  {bet.sport} · {formatBetType(bet.betType)}
                                </span>
                                <ProfitBoostBadge
                                  percent={bet.profitBoostPercent}
                                />
                              </div>
                            </div>
                            {bet.status === "pending" ? (
                              <Badge
                                variant="outline"
                                className="min-w-[64px] justify-center"
                              >
                                Pending
                              </Badge>
                            ) : bet.status === "won" ? (
                              <Badge
                                variant="success"
                                className="min-w-[64px] justify-center"
                              >
                                Won
                              </Badge>
                            ) : bet.status === "lost" ? (
                              <Badge
                                variant="destructive"
                                className="min-w-[64px] justify-center"
                              >
                                Lost
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="min-w-[64px] justify-center"
                              >
                                Push
                              </Badge>
                            )}
                          </div>
                          <ParlayLegsSummary
                            legs={bet.parlayLegs}
                            isParlay={bet.betType === "parlay"}
                            status={bet.status}
                          />
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                            <div>
                              <div className="text-xs text-muted-foreground">
                                Odds
                              </div>
                              <div className="font-mono font-semibold">
                                {formatOdds(bet.odds)}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">
                                Wager
                              </div>
                              <div className="font-mono font-semibold">
                                {formatCurrency(bet.wager)}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">
                                Payout
                              </div>
                              <div className="font-mono font-semibold">
                                {totalPayout == null
                                  ? "—"
                                  : formatCurrency(totalPayout)}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">
                                Profit / Units
                              </div>
                              <div
                                className={`font-mono text-[15px] font-semibold ${winnings > 0 ? "text-green-400" : winnings < 0 ? "text-red-400" : ""}`}
                              >
                                {winnings > 0 ? "+" : ""}
                                {formatCurrency(winnings)}{" "}
                                <span className="text-slate-300">/</span>{" "}
                                {formatUnits(winnings, unitSize)}
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setShareBet(bet)}
                            >
                              <Share2 className="mr-1.5 h-3.5 w-3.5" /> Share
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={bet.status === "won"}
                              onClick={() => handleSettle(bet.id, "won")}
                            >
                              Won
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={bet.status === "lost"}
                              onClick={() => handleSettle(bet.id, "lost")}
                            >
                              Lost
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={bet.status === "push"}
                              onClick={() => handleSettle(bet.id, "push")}
                            >
                              Push
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => openConfigure(bet)}
                            >
                              Configure
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-10 text-center text-sm text-muted-foreground">
                      {historyFilter === "all"
                        ? "No mock bets yet."
                        : "No bets match this result."}
                    </div>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      </div>

      <Modal
        open={placeOpen}
        onClose={() => setPlaceOpen(false)}
        title="Place Mock Bet"
        wide
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <BetModeToggle value={betMode} onChange={setBetMode} />
          {betMode === "parlay" ? (
            <ParlayLegEditor
              legs={parlayLegs}
              onChange={setParlayLegs}
              showErrors={createAttempted}
            />
          ) : (
            <div>
              <label className="mb-1.5 block text-xs font-mono uppercase text-muted-foreground">
                Description <span className="text-destructive">*</span>
              </label>
              <Input
                aria-invalid={descriptionInvalid}
                aria-describedby={
                  descriptionInvalid ? "mock-description-error" : undefined
                }
                autoFocus
                placeholder="e.g. Steph Curry over 5.5 threes"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className={`bg-background/50 ${descriptionInvalid ? "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-200" : ""}`}
              />
              {descriptionInvalid && (
                <p
                  id="mock-description-error"
                  className="mt-1.5 text-xs font-medium text-red-600"
                  role="alert"
                >
                  Enter a description for this bet.
                </p>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label className="block text-xs font-mono uppercase text-muted-foreground">
                  Wager ($) *
                </label>
                {wallet && (
                  <span className="font-mono text-[10px] text-muted-foreground">
                    Available {formatCurrency(wallet.balance)}
                  </span>
                )}
              </div>
              <Input
                aria-invalid={wagerInvalid}
                aria-describedby={wagerInvalid ? "mock-wager-error" : undefined}
                type="number"
                step="0.01"
                placeholder="100"
                value={wager}
                onChange={(event) => setWager(event.target.value)}
                className={`bg-background/50 font-mono ${wagerInvalid ? "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-200" : ""}`}
              />
              {wagerInvalid && (
                <p
                  id="mock-wager-error"
                  className="mt-1.5 text-xs font-medium text-red-600"
                  role="alert"
                >
                  {wagerExceedsWallet && wallet
                    ? `Wager cannot exceed ${formatCurrency(wallet.balance)}.`
                    : "Enter a wager greater than $0."}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-mono uppercase text-muted-foreground">
                {betMode === "parlay" ? "Combined Odds" : "American Odds *"}
              </label>
              <Input
                aria-invalid={oddsInvalid}
                aria-describedby={oddsInvalid ? "mock-odds-error" : undefined}
                type={betMode === "parlay" ? "text" : "number"}
                readOnly={betMode === "parlay"}
                placeholder="-110"
                value={
                  betMode === "parlay"
                    ? effectiveOdds
                      ? formatOdds(effectiveOdds)
                      : ""
                    : odds
                }
                onChange={(event) => setOdds(event.target.value)}
                className={`bg-background/50 font-mono ${oddsInvalid ? "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-200" : ""}`}
              />
              {oddsInvalid && (
                <p
                  id="mock-odds-error"
                  className="mt-1.5 text-xs font-medium text-red-600"
                  role="alert"
                >
                  Enter valid American odds.
                </p>
              )}
            </div>
          </div>
          {betMode === "straight" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-mono uppercase text-muted-foreground">
                  Sport
                </label>
                <Select value={sport} onValueChange={setSport}>
                  <SelectTrigger className="bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["NBA", "WNBA", "MLB", "NFL"].map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-mono uppercase text-muted-foreground">
                  Type
                </label>
                <Select value={betType} onValueChange={setBetType}>
                  <SelectTrigger className="bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BET_TYPE_OPTIONS.filter(
                      (option) => option.value !== "parlay",
                    ).map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <ProfitBoostControl
            value={profitBoost}
            onValueChange={setProfitBoost}
          />
          {wager && effectiveOdds !== 0 && (
            <div className="flex items-center justify-between rounded-lg border border-border bg-slate-50 px-3 py-2.5">
              <span className="text-xs font-mono uppercase text-muted-foreground">
                Potential Payout
              </span>
              <span className="font-mono text-lg font-bold text-emerald-600">
                {formatCurrency(potentialPayoutPreview)}
              </span>
            </div>
          )}
          <div className="flex gap-3 border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setPlaceOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 font-display uppercase tracking-wider"
              disabled={createBet.isPending || !wallet}
            >
              {createBet.isPending ? "Placing…" : "Place Mock Bet →"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Edit Balance modal ────────────────────── */}
      <Modal
        open={unitOpen}
        onClose={() => setUnitOpen(false)}
        title="Unit Size"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
            <div className="text-xs font-medium text-emerald-700">
              Current Unit
            </div>
            <div className="font-mono text-xl font-bold text-emerald-700">
              1u = {formatCurrency(unitSize)}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Sizing Method
            </div>
            <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setUnitModeDraft("auto")}
                className={`whitespace-nowrap px-3 py-2 text-sm font-semibold transition-colors ${unitModeDraft === "auto" ? "bg-primary text-primary-foreground" : "bg-white text-slate-600 hover:bg-muted"}`}
              >
                Auto · 1%
              </button>
              <button
                type="button"
                onClick={() => setUnitModeDraft("custom")}
                className={`whitespace-nowrap border-l border-border px-3 py-2 text-sm font-semibold transition-colors ${unitModeDraft === "custom" ? "bg-primary text-primary-foreground" : "bg-white text-slate-600 hover:bg-muted"}`}
              >
                Custom
              </button>
            </div>
          </div>
          {unitModeDraft === "custom" ? (
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Dollar Value Per Unit
              </label>
              <Input
                aria-label="Custom unit size"
                type="number"
                min="0.01"
                step="0.01"
                value={customUnitInput}
                onChange={(event) => setCustomUnitInput(event.target.value)}
                className="bg-slate-50 font-mono"
              />
            </div>
          ) : (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Automatically uses 1% of your{" "}
              {formatCurrency(wallet?.startingBalance ?? 0)} starting bankroll.
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => setUnitOpen(false)}
              className="flex-1"
              disabled={unitsBusy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveUnits}
              className="flex-1"
              disabled={unitsBusy}
            >
              {unitsBusy ? "Saving..." : "Save Unit Size"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Balance"
      >
        <div className="space-y-4">
          {/* Set balance */}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">
              Set Balance To
            </label>
            <div className="flex gap-2">
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder={formatCurrency(wallet?.balance ?? 0)}
                value={setBalanceVal}
                onChange={(e) => setSetBalanceVal(e.target.value)}
                className="bg-muted/30 font-mono"
              />
              <Button onClick={handleSetBalance} className="shrink-0">
                Set
              </Button>
            </div>
          </div>

          <div className="relative flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-sm text-muted-foreground">or adjust</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Add / subtract */}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">
              Add or Remove Funds
            </label>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setAdjustDir("add")}
                className={`flex-1 flex items-center justify-center gap-1 py-2 text-sm font-semibold border rounded-lg transition-colors ${adjustDir === "add" ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-border text-muted-foreground hover:bg-muted"}`}
              >
                <Plus className="w-3 h-3" /> Add
              </button>
              <button
                onClick={() => setAdjustDir("subtract")}
                className={`flex-1 flex items-center justify-center gap-1 py-2 text-sm font-semibold border rounded-lg transition-colors ${adjustDir === "subtract" ? "border-red-600 bg-red-50 text-red-700" : "border-border text-muted-foreground hover:bg-muted"}`}
              >
                <Minus className="w-3 h-3" /> Remove
              </button>
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Amount"
                value={adjustAmt}
                onChange={(e) => setAdjustAmt(e.target.value)}
                className="bg-muted/30 font-mono"
              />
              <Button
                onClick={handleAdjust}
                variant="outline"
                className="shrink-0"
              >
                Apply
              </Button>
            </div>
            {/* Quick amounts */}
            <div className="flex gap-1.5 mt-2">
              {[100, 500, 1000, 5000].map((a) => (
                <button
                  key={a}
                  onClick={() => setAdjustAmt(String(a))}
                  className="flex-1 py-1.5 text-sm font-mono border border-border rounded hover:bg-muted transition-colors"
                >
                  {a >= 1000 ? `${a / 1000}k` : a}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={configureOpen}
        onClose={() => setConfigureOpen(false)}
        title="Configure Mock Bet"
        wide
      >
        <div className="space-y-4">
          <BetModeToggle value={configuredMode} onChange={setConfiguredMode} />
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">
              Bet Name *
            </label>
            <Input
              aria-label="Bet Name"
              aria-invalid={configuredDescriptionInvalid}
              aria-describedby={
                configuredDescriptionInvalid
                  ? "mock-config-name-error"
                  : undefined
              }
              value={configuredDescription}
              onChange={(event) => setConfiguredDescription(event.target.value)}
              className={
                configuredDescriptionInvalid
                  ? "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-200"
                  : ""
              }
            />
            {configuredDescriptionInvalid && (
              <p
                id="mock-config-name-error"
                className="mt-1.5 text-xs font-medium text-red-600"
                role="alert"
              >
                Enter a name for this bet.
              </p>
            )}
          </div>
          {configuredMode === "parlay" && (
            <ParlayLegEditor
              legs={configuredParlayLegs}
              onChange={setConfiguredParlayLegs}
              showErrors={configureAttempted}
            />
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">
                Wager ($) *
              </label>
              <Input
                aria-invalid={configuredWagerInvalid}
                aria-describedby={
                  configuredWagerInvalid ? "mock-config-wager-error" : undefined
                }
                type="number"
                min="0.01"
                step="0.01"
                className={`font-mono ${configuredWagerInvalid ? "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-200" : ""}`}
                value={configuredWager}
                onChange={(e) => setConfiguredWager(e.target.value)}
              />
              {configuredWagerInvalid && (
                <p
                  id="mock-config-wager-error"
                  className="mt-1.5 text-xs font-medium text-red-600"
                  role="alert"
                >
                  Enter a wager greater than $0.
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">
                {configuredMode === "parlay" ? "Combined Odds" : "Odds *"}
              </label>
              <Input
                aria-invalid={configuredOddsInvalid}
                aria-describedby={
                  configuredOddsInvalid ? "mock-config-odds-error" : undefined
                }
                type={configuredMode === "parlay" ? "text" : "number"}
                readOnly={configuredMode === "parlay"}
                className={`font-mono ${configuredOddsInvalid ? "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-200" : ""}`}
                value={
                  configuredMode === "parlay"
                    ? formatOdds(calculateParlayOdds(configuredParlayLegs))
                    : configuredOdds
                }
                onChange={(e) => setConfiguredOdds(e.target.value)}
              />
              {configuredOddsInvalid && (
                <p
                  id="mock-config-odds-error"
                  className="mt-1.5 text-xs font-medium text-red-600"
                  role="alert"
                >
                  Enter valid American odds.
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">
                Status
              </label>
              <Select
                value={configuredStatus}
                onValueChange={(value) =>
                  setConfiguredStatus(value as typeof configuredStatus)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="won">Won</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                  <SelectItem value="push">Push</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {configuredMode === "straight" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">
                  Sport
                </label>
                <Select
                  value={configuredSport}
                  onValueChange={setConfiguredSport}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["NBA", "WNBA", "MLB", "NFL"].map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">
                  Bet Type
                </label>
                <Select
                  value={configuredType}
                  onValueChange={setConfiguredType}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BET_TYPE_OPTIONS.filter(
                      (option) => option.value !== "parlay",
                    ).map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <ProfitBoostControl
            value={configuredProfitBoost}
            onValueChange={setConfiguredProfitBoost}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            {deleteConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Remove this bet?
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDeleteConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={configureBusy}
                  onClick={handleDeleteBet}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteConfirm(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Remove bet
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={() => setConfigureOpen(false)}>
                Cancel
              </Button>
              <Button disabled={configureBusy} onClick={handleConfigureSave}>
                {configureBusy ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* ── Reset modal ───────────────────────────── */}
      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset Wallet"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will{" "}
            <span className="text-foreground font-medium">
              delete all mock betting history
            </span>{" "}
            and reset your balance to the starting amount.
          </p>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">
              Starting Balance
            </label>
            <Input
              type="number"
              step="100"
              min="100"
              value={newStart}
              onChange={(e) => setNewStart(e.target.value)}
              className="bg-muted/30 font-mono"
            />
            <div className="flex gap-1.5 mt-2">
              {[100, 500, 1000, 5000].map((a) => (
                <button
                  key={a}
                  onClick={() => setNewStart(String(a))}
                  className={`flex-1 py-1.5 text-sm font-mono border rounded transition-colors ${newStart === String(a) ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}
                >
                  {a >= 1000 ? `${a / 1000}k` : a}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              onClick={() => setResetOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleReset}
              variant="destructive"
              disabled={resetWallet.isPending}
              className="flex-1"
            >
              {resetWallet.isPending ? "Resetting…" : "Reset Wallet"}
            </Button>
          </div>
        </div>
      </Modal>
      <ShareBetDialog
        bet={shareBet}
        source="mock"
        onClose={() => setShareBet(null)}
      />
    </div>
  );
}
