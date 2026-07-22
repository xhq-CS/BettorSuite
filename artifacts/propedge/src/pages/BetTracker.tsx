import { useState, useMemo, useEffect } from "react";
import {
  useListBets,
  useCreateBet,
  useUpdateBet,
  useGetBetSummary,
  useGetSimulatorWallet,
  getListBetsQueryKey,
  getGetBetSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  Trophy,
  TrendingUp,
  Target,
  Plus,
  CheckCircle2,
  XCircle,
  X,
  CalendarDays,
  List,
  Edit2,
  Trash2,
  MinusCircle,
  Wallet,
  RotateCcw,
  Share2,
} from "lucide-react";
import { format } from "date-fns";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";
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
import { SportsbookPicker } from "@/components/SportsbookPicker";
import {
  HistoryStatusFilter,
  type HistoryStatusFilterValue,
} from "@/components/HistoryStatusFilter";

const SPORTSBOOKS = [
  { name: "DraftKings", logo: "/sportsbooks/draftkings.avif" },
  { name: "FanDuel", logo: "/sportsbooks/fanduel.jfif" },
] as const;

function sportsbookLogo(name?: string | null) {
  return SPORTSBOOKS.find(
    (book) => book.name.toLowerCase() === name?.trim().toLowerCase(),
  );
}

function SportsbookLabel({ name }: { name?: string | null }) {
  const book = sportsbookLogo(name);
  if (!name) return <span>—</span>;
  return (
    <span className="inline-flex items-center gap-2 normal-case">
      {book && (
        <img
          src={book.logo}
          alt=""
          className="h-6 w-6 shrink-0 rounded-md border border-slate-200 bg-white object-contain p-0.5"
        />
      )}
      <span className="truncate">{name}</span>
    </span>
  );
}

export default function BetTracker() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<HistoryStatusFilterValue>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [historyView, setHistoryView] = useState<"table" | "calendar">("table");
  const [configureOpen, setConfigureOpen] = useState(false);
  const [configuredBetId, setConfiguredBetId] = useState<number | null>(null);
  const [configuredDescription, setConfiguredDescription] = useState("");
  const [configuredType, setConfiguredType] = useState("prop");
  const [configuredBook, setConfiguredBook] = useState("");
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
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [profitDisplay, setProfitDisplay] = useState<"money" | "units">(
    "money",
  );
  const [chartDisplay, setChartDisplay] = useState<"money" | "units">("money");
  const [walletOpen, setWalletOpen] = useState(false);
  const [walletInput, setWalletInput] = useState("");
  const [walletBusy, setWalletBusy] = useState(false);
  const [resetWageredOpen, setResetWageredOpen] = useState(false);
  const [resetWageredBusy, setResetWageredBusy] = useState(false);
  const [shareBet, setShareBet] = useState<ShareableBet | null>(null);

  useEffect(() => {
    if (!resetWageredOpen && !walletOpen && !modalOpen && !configureOpen)
      return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (configureOpen) setConfigureOpen(false);
      else if (modalOpen) setModalOpen(false);
      else if (walletOpen) setWalletOpen(false);
      else if (resetWageredOpen) setResetWageredOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [configureOpen, modalOpen, resetWageredOpen, walletOpen]);

  const { data: bets, isLoading: betsLoading } = useListBets(
    filter === "all" ? undefined : { status: filter as any },
  );
  const betList = Array.isArray(bets) ? bets : [];

  const { data: summary, isLoading: summaryLoading } = useGetBetSummary();
  const { data: unitWallet } = useGetSimulatorWallet();
  const { data: trackerWallet, isLoading: trackerWalletLoading } = useQuery({
    queryKey: ["tracker-wallet"],
    queryFn: () => api<{ balance: number }>("/bets/wallet"),
  });

  const createBet = useCreateBet();
  const updateBet = useUpdateBet();

  // Form State
  const [description, setDescription] = useState("");
  const [betType, setBetType] = useState("prop");
  const [sportsbook, setSportsbook] = useState("");
  const [wager, setWager] = useState("");
  const [odds, setOdds] = useState("");
  const [profitBoost, setProfitBoost] = useState("");
  const [sport, setSport] = useState("NBA");
  const [betMode, setBetMode] = useState<"straight" | "parlay">("straight");
  const [parlayLegs, setParlayLegs] =
    useState<ParlayLegDraft[]>(createParlayLegs);
  const [createAttempted, setCreateAttempted] = useState(false);

  const effectiveOdds =
    betMode === "parlay" ? calculateParlayOdds(parlayLegs) : Number(odds);
  const descriptionInvalid =
    createAttempted && betMode === "straight" && !description.trim();
  const wagerExceedsWallet =
    createAttempted &&
    Boolean(trackerWallet) &&
    Number.isFinite(Number(wager)) &&
    Number(wager) > Number(trackerWallet?.balance ?? 0);
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
  const refreshBets = () => {
    queryClient.invalidateQueries({ queryKey: getListBetsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetBetSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: ["tracker-wallet"] });
  };

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
      toast.error("Please fill all required fields");
      return;
    }
    if (trackerWallet && Number(wager) > trackerWallet.balance) {
      toast.error(
        `Wager cannot exceed ${formatCurrency(trackerWallet.balance)}.`,
      );
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
          sportsbook,
          wager: Number(wager),
          odds: effectiveOdds,
          parlayLegs: betMode === "parlay" ? normalizedLegs! : undefined,
          profitBoostPercent: Number(profitBoost || 0),
          sport,
        },
      },
      {
        onSuccess: () => {
          toast.success("Bet logged successfully");
          setDescription("");
          setWager("");
          setOdds("");
          setSportsbook("");
          setProfitBoost("");
          setBetMode("straight");
          setParlayLegs(createParlayLegs());
          setCreateAttempted(false);
          refreshBets();
          setModalOpen(false);
        },
        onError: (error) =>
          toast.error(
            error instanceof Error ? error.message : "Failed to log bet",
          ),
      },
    );
  };

  const handleSettle = (id: number, status: "won" | "lost" | "push") => {
    const bet = betList.find((b) => b.id === id);
    if (!bet) return;

    let actualPayout = 0;
    if (status === "won") actualPayout = bet.potentialPayout || 0;
    if (status === "push") actualPayout = bet.wager;

    updateBet.mutate(
      {
        id,
        data: { status, actualPayout },
      },
      {
        onSuccess: () => {
          toast.success(`Bet marked as ${status}`);
          refreshBets();
        },
      },
    );
  };

  const openConfigure = (bet: any) => {
    setConfigureAttempted(false);
    setConfiguredBetId(bet.id);
    setConfiguredDescription(bet.description);
    setConfiguredType(bet.betType);
    setConfiguredBook(bet.sportsbook ?? "");
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

  const saveConfiguredBet = async () => {
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
      await api(`/bets/${configuredBetId}`, {
        method: "PATCH",
        body: JSON.stringify({
          description: configuredDescription.trim(),
          betType: configuredMode === "parlay" ? "parlay" : configuredType,
          sportsbook: configuredBook,
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
      toast.success("Bet updated");
      setConfigureAttempted(false);
      setConfigureOpen(false);
      refreshBets();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to update bet",
      );
    } finally {
      setConfigureBusy(false);
    }
  };

  const removeConfiguredBet = async () => {
    if (!configuredBetId) return;
    setConfigureBusy(true);
    try {
      await api(`/bets/${configuredBetId}`, { method: "DELETE" });
      toast.success("Bet removed");
      setConfigureOpen(false);
      refreshBets();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to remove bet",
      );
    } finally {
      setConfigureBusy(false);
    }
  };

  const openWallet = () => {
    setWalletInput(Number(trackerWallet?.balance ?? 0).toFixed(2));
    setWalletOpen(true);
  };

  const saveWallet = async () => {
    const requestedBalance = Number(walletInput);
    if (!Number.isFinite(requestedBalance) || requestedBalance < 0) {
      toast.error("Enter a valid wallet balance");
      return;
    }
    const balance = Math.round((requestedBalance + Number.EPSILON) * 100) / 100;
    setWalletBusy(true);
    try {
      await api<{ balance: number }>("/bets/wallet", {
        method: "PATCH",
        body: JSON.stringify({ balance }),
      });
      await queryClient.invalidateQueries({ queryKey: ["tracker-wallet"] });
      setWalletOpen(false);
      toast.success("Tracker wallet updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to update wallet",
      );
    } finally {
      setWalletBusy(false);
    }
  };

  const resetTotalWagered = async () => {
    setResetWageredBusy(true);
    try {
      await api("/bets/summary/reset-total-wagered", { method: "POST" });
      await queryClient.invalidateQueries({
        queryKey: getGetBetSummaryQueryKey(),
      });
      setResetWageredOpen(false);
      toast.success("Total wagered reset");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to reset total wagered",
      );
    } finally {
      setResetWageredBusy(false);
    }
  };

  const trackerUnitSize = Math.max(0.01, Number(unitWallet?.unitSize ?? 1));

  const { chartData, pieData, outcomeData } = useMemo(() => {
    const sorted = [...betList].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    let runningTotal = 0;
    const chartData = sorted
      .filter((b) => b.status !== "pending")
      .map((bet) => {
        if (bet.status === "won")
          runningTotal += (bet.potentialPayout || 0) - bet.wager;
        else if (bet.status === "lost") runningTotal -= bet.wager;
        return {
          date: format(new Date(bet.createdAt), "MMM d"),
          profit: runningTotal,
          units: runningTotal / trackerUnitSize,
        };
      });

    let won = 0,
      lost = 0,
      push = 0;
    betList.forEach((b) => {
      if (b.status === "won") won++;
      if (b.status === "lost") lost++;
      if (b.status === "push") push++;
    });

    const outcomeData = [
      { name: "Won", value: won, color: "#22c55e" },
      { name: "Lost", value: lost, color: "#ef4444" },
      { name: "Push", value: push, color: "#555555" },
    ];
    const pieData = outcomeData.filter((d) => d.value > 0);

    return { chartData, pieData, outcomeData };
  }, [betList, trackerUnitSize]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
          <p className="text-muted-foreground text-xs font-mono mb-1">
            {label}
          </p>
          <p
            className="font-mono font-bold text-sm"
            style={{
              color: payload[0].payload.profit >= 0 ? "#22c55e" : "#ef4444",
            }}
          >
            {chartDisplay === "money"
              ? formatCurrency(payload[0].value)
              : `${Number(payload[0].value).toFixed(2)}u`}
          </p>
        </div>
      );
    }
    return null;
  };

  const PieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
          <p className="font-mono font-bold text-sm text-slate-900">
            {payload[0].name}: {payload[0].value}
          </p>
        </div>
      );
    }
    return null;
  };

  const winRatePct = ((summary?.winRate ?? 0) * 100).toFixed(1);
  const roiPct = ((summary?.roi ?? 0) * 100).toFixed(1);
  const trackerProfitUnits = (summary?.totalProfit ?? 0) / trackerUnitSize;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tighter mb-2">
            BOOK KEEPER
          </h1>
          <p className="text-muted-foreground text-sm font-mono uppercase tracking-wider">
            Log & Analyze Your Action
          </p>
        </div>
        <Button
          onClick={() => {
            setCreateAttempted(false);
            setModalOpen(true);
          }}
          className="font-display uppercase tracking-wider gap-2 h-10 px-5"
        >
          <Plus className="w-4 h-4" /> Log New Bet
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-card/40 border-border">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] leading-4 text-muted-foreground uppercase tracking-wider">
                Wallet
              </p>
              <button
                type="button"
                onClick={openWallet}
                aria-label="Edit tracker wallet"
                title="Match sportsbook balance"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Edit2 className="h-4 w-4" />
              </button>
            </div>
            {trackerWalletLoading ? (
              <div className="mt-1 h-8 w-24 bg-muted animate-pulse rounded" />
            ) : (
              <p className="mt-1 whitespace-nowrap text-2xl font-mono font-bold tracking-tight text-foreground">
                {formatCurrency(trackerWallet?.balance ?? 0)}
              </p>
            )}
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Wallet className="h-3 w-3" /> Match your sportsbook
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-[10px] leading-4 text-muted-foreground uppercase tracking-wider">
                  Win Rate
                </p>
                {summaryLoading ? (
                  <div className="h-8 w-16 bg-muted animate-pulse rounded" />
                ) : (
                  <p className="text-3xl font-mono font-bold text-green-400">
                    {winRatePct}%
                  </p>
                )}
              </div>
              <Target className="w-4 h-4 text-muted-foreground opacity-50" />
            </div>
            <p className="text-xs font-mono text-muted-foreground mt-2">
              {summary?.wins}W - {summary?.losses}L - {summary?.pushes}P
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-[10px] leading-4 text-muted-foreground uppercase tracking-wider">
                  Net Profit
                </p>
                {summaryLoading ? (
                  <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                ) : (
                  <p
                    className={`text-3xl font-mono font-bold ${(summary?.totalProfit ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}
                  >
                    {(summary?.totalProfit ?? 0) >= 0 ? "+" : ""}
                    {profitDisplay === "money"
                      ? formatCurrency(summary?.totalProfit || 0)
                      : `${trackerProfitUnits.toFixed(2)}u`}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() =>
                  setProfitDisplay((current) =>
                    current === "money" ? "units" : "money",
                  )
                }
                className="min-w-7 rounded-md border border-transparent px-1.5 py-0.5 font-mono text-sm font-bold text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground"
                aria-label={`Show net profit in ${profitDisplay === "money" ? "units" : "dollars"}`}
                title={`Switch to ${profitDisplay === "money" ? "units" : "dollars"}`}
              >
                {profitDisplay === "money" ? "$" : "u"}
              </button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-[10px] leading-4 text-muted-foreground uppercase tracking-wider">
                  ROI
                </p>
                {summaryLoading ? (
                  <div className="h-8 w-20 bg-muted animate-pulse rounded" />
                ) : (
                  <p
                    className={`text-3xl font-mono font-bold ${Number(roiPct) >= 0 ? "text-green-400" : "text-red-400"}`}
                  >
                    {Number(roiPct) >= 0 ? "+" : ""}
                    {roiPct}%
                  </p>
                )}
              </div>
              <TrendingUp className="w-4 h-4 text-muted-foreground opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-[10px] leading-4 text-muted-foreground uppercase tracking-wider">
                  Total Wagered
                </p>
                {summaryLoading ? (
                  <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                ) : (
                  <p className="text-3xl font-mono font-bold text-foreground">
                    {formatCurrency(summary?.totalWagered || 0)}
                  </p>
                )}
              </div>
              <div className="flex items-start gap-1">
                <button
                  type="button"
                  onClick={() => setResetWageredOpen(true)}
                  aria-label="Reset total wagered"
                  title="Reset counter"
                  className="flex h-6 w-6 -mt-1 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
                <Trophy className="w-4 h-4 text-muted-foreground opacity-50" />
              </div>
            </div>
            <p className="text-xs font-mono text-muted-foreground mt-2">
              {summary?.totalBets} Total Bets
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card/40 border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-xs font-mono uppercase text-muted-foreground tracking-wider">
                Profit Curve
              </CardTitle>
              <div
                className="flex overflow-hidden rounded-lg border border-border"
                aria-label="Tracker profit graph display"
              >
                <button
                  type="button"
                  onClick={() => setChartDisplay("money")}
                  className={`min-w-9 px-2.5 py-1 text-xs font-mono font-bold transition-colors ${chartDisplay === "money" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                >
                  $
                </button>
                <button
                  type="button"
                  onClick={() => setChartDisplay("units")}
                  className={`min-w-9 border-l border-border px-2.5 py-1 text-xs font-mono font-bold transition-colors ${chartDisplay === "units" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                >
                  Units
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <div className="h-[220px] w-full">
              {!betsLoading && chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="colorProfit"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor={
                            chartData[chartData.length - 1]?.profit >= 0
                              ? "#22c55e"
                              : "#ef4444"
                          }
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor={
                            chartData[chartData.length - 1]?.profit >= 0
                              ? "#22c55e"
                              : "#ef4444"
                          }
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#ffffff10"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "#888" }}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={20}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#888" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) =>
                        chartDisplay === "money"
                          ? `$${val}`
                          : `${Number(val).toFixed(2)}u`
                      }
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey={chartDisplay === "money" ? "profit" : "units"}
                      stroke={
                        chartData[chartData.length - 1]?.profit >= 0
                          ? "#22c55e"
                          : "#ef4444"
                      }
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
            <CardTitle className="text-xs font-mono uppercase text-muted-foreground tracking-wider">
              Outcomes
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="h-[164px] w-full relative">
              {!betsLoading && pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={76}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
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
            {!betsLoading && pieData.length > 0 && (
              <div
                className="grid grid-cols-3 gap-2 pt-2"
                aria-label="Outcome totals"
              >
                {outcomeData.map((outcome) => (
                  <div
                    key={outcome.name}
                    className="flex min-w-0 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-2"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: outcome.color }}
                    />
                    <span className="truncate text-xs font-medium text-slate-600">
                      {outcome.name}
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-900">
                      {outcome.value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bet History */}
      <Card className="bg-card/40 border-border">
        <CardHeader className="pb-0 border-b border-border">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
            <div className="flex items-center gap-3">
              <CardTitle className="text-lg font-display">
                Bet History
              </CardTitle>
              {/* Table / Calendar toggle */}
              <div className="flex rounded-lg border border-border overflow-hidden">
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
            <HistoryStatusFilter value={filter} onValueChange={setFilter} />
          </div>
        </CardHeader>

        {/* Calendar view */}
        {historyView === "calendar" && (
          <CardContent className="pt-5">
            <BetCalendar bets={betList} label="Tracker" showDayDetails />
          </CardContent>
        )}

        {/* Table view */}
        {historyView === "table" && (
          <CardContent className="p-0 overflow-hidden">
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
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : betList.length ? (
                  betList.map((bet) => {
                    const winnings =
                      bet.status === "won"
                        ? (bet.actualPayout ?? bet.potentialPayout ?? 0) -
                          bet.wager
                        : bet.status === "lost"
                          ? -bet.wager
                          : bet.status === "pending"
                            ? (bet.potentialPayout ?? 0) - bet.wager
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
                          <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground">
                            <SportsbookLabel name={bet.sportsbook} />
                            <span>·</span>
                            <span>{bet.sport}</span>
                            <span>·</span>
                            <span>{formatBetType(bet.betType)}</span>
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
                            <span>
                              {winnings > 0 ? "+" : ""}
                              {(winnings / trackerUnitSize).toFixed(2)}u
                            </span>
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
                              disabled={
                                bet.status === "won" || updateBet.isPending
                              }
                              onClick={() => handleSettle(bet.id, "won")}
                              className="w-[30px] h-[30px] rounded-md bg-green-500/10 hover:bg-green-500/20 text-green-400 disabled:opacity-35 flex items-center justify-center transition-colors"
                              title="Mark Won"
                            >
                              <CheckCircle2 className="w-[15px] h-[15px]" />
                            </button>
                            <button
                              aria-label="Mark bet as lost"
                              disabled={
                                bet.status === "lost" || updateBet.isPending
                              }
                              onClick={() => handleSettle(bet.id, "lost")}
                              className="w-[30px] h-[30px] rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-400 disabled:opacity-35 flex items-center justify-center transition-colors"
                              title="Mark Lost"
                            >
                              <XCircle className="w-[15px] h-[15px]" />
                            </button>
                            <button
                              aria-label="Mark bet as push"
                              disabled={
                                bet.status === "push" || updateBet.isPending
                              }
                              onClick={() => handleSettle(bet.id, "push")}
                              className="w-[30px] h-[30px] rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 disabled:opacity-35 flex items-center justify-center transition-colors"
                              title="Mark Push"
                            >
                              <MinusCircle className="w-[15px] h-[15px]" />
                            </button>
                            <button
                              aria-label="Share bet"
                              onClick={() => setShareBet(bet)}
                              className="flex h-[30px] w-[30px] items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-600 transition-colors hover:bg-blue-100"
                              title="Share bet"
                            >
                              <Share2 className="h-[15px] w-[15px]" />
                            </button>
                            <button
                              aria-label="Configure bet"
                              onClick={() => openConfigure(bet)}
                              className="w-[30px] h-[30px] rounded-md border border-border hover:bg-muted text-slate-600 flex items-center justify-center transition-colors"
                              title="Configure bet"
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
                      {filter === "all"
                        ? "No Book Keeper bets yet."
                        : "No bets match this result."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <div className="xl:hidden divide-y divide-border">
              {betsLoading ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Loading...
                </div>
              ) : betList.length ? (
                betList.map((bet) => {
                  const winnings =
                    bet.status === "won"
                      ? (bet.actualPayout ?? bet.potentialPayout ?? 0) -
                        bet.wager
                      : bet.status === "lost"
                        ? -bet.wager
                        : bet.status === "pending"
                          ? (bet.potentialPayout ?? 0) - bet.wager
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
                        <div className="min-w-0">
                          <div className="font-display font-semibold text-slate-900">
                            {bet.description}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-1.5">
                            <span>
                              {format(new Date(bet.createdAt), "MMM d")}
                            </span>
                            <span>·</span>
                            <SportsbookLabel name={bet.sportsbook} />
                            <span>·</span>
                            <span>{bet.sport}</span>
                            <span>·</span>
                            <span>{formatBetType(bet.betType)}</span>
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
                            {winnings > 0 ? "+" : ""}
                            {(winnings / trackerUnitSize).toFixed(2)}u
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
                        <Button size="sm" onClick={() => openConfigure(bet)}>
                          Configure
                        </Button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-10 text-center text-sm text-muted-foreground">
                  {filter === "all"
                    ? "No Book Keeper bets yet."
                    : "No bets match this result."}
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {resetWageredOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden rounded-xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-display uppercase tracking-wider">
                  <RotateCcw className="h-5 w-5 text-primary" /> Reset Total
                  Wagered
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  The counter will restart at $0. Your bet history, wallet, and
                  results will stay unchanged.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setResetWageredOpen(false)}
                aria-label="Close total wagered reset"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-red-500 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex gap-2 p-5">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setResetWageredOpen(false)}
                disabled={resetWageredBusy}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={resetTotalWagered}
                disabled={resetWageredBusy}
              >
                {resetWageredBusy ? "Resetting..." : "Reset Counter"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tracker Wallet Modal */}
      {walletOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden rounded-xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-display uppercase tracking-wider">
                  <Wallet className="h-5 w-5 text-primary" /> Tracker Wallet
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Set this to your current sportsbook balance.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWalletOpen(false)}
                aria-label="Close tracker wallet"
                className="flex h-8 w-8 items-center justify-center rounded-md text-red-500 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <div className="space-y-2">
                <label className="text-xs font-mono uppercase text-muted-foreground">
                  Sportsbook Balance
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">
                    $
                  </span>
                  <Input
                    aria-label="Sportsbook balance"
                    type="number"
                    min="0"
                    step="0.01"
                    value={walletInput}
                    onChange={(event) => setWalletInput(event.target.value)}
                    className="pl-7 font-mono text-lg"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setWalletOpen(false)}
                  disabled={walletBusy}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  onClick={saveWallet}
                  disabled={walletBusy}
                >
                  {walletBusy ? "Saving..." : "Save Wallet"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Log New Bet Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-xl mx-4 overflow-y-auto bg-card border border-border rounded-xl shadow-xl animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="flex items-center gap-2 text-lg font-display uppercase tracking-wider">
                <Plus className="w-5 h-5 text-primary" /> Log New Bet
              </h2>
              <button
                type="button"
                aria-label="Close log new bet"
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-md flex items-center justify-center text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreate} className="p-6 space-y-5">
              <BetModeToggle value={betMode} onChange={setBetMode} />

              {betMode === "parlay" ? (
                <ParlayLegEditor
                  legs={parlayLegs}
                  onChange={setParlayLegs}
                  showErrors={createAttempted}
                />
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-mono uppercase text-muted-foreground">
                      Description *
                    </label>
                    <Input
                      aria-invalid={descriptionInvalid}
                      aria-describedby={
                        descriptionInvalid
                          ? "tracker-description-error"
                          : undefined
                      }
                      placeholder="e.g. LeBron James O 25.5 PTS"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className={`bg-background/50 ${descriptionInvalid ? "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-200" : ""}`}
                    />
                    {descriptionInvalid && (
                      <p
                        id="tracker-description-error"
                        className="text-xs font-medium text-red-600"
                        role="alert"
                      >
                        Enter a description for this bet.
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-mono uppercase text-muted-foreground">
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
                    <div className="space-y-2">
                      <label className="text-xs font-mono uppercase text-muted-foreground">
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
                </>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-mono uppercase text-muted-foreground">
                      Wager ($) *
                    </label>
                    {trackerWallet && (
                      <span className="font-mono text-[10px] text-muted-foreground">
                        Available {formatCurrency(trackerWallet.balance)}
                      </span>
                    )}
                  </div>
                  <Input
                    aria-invalid={wagerInvalid}
                    aria-describedby={
                      wagerInvalid ? "tracker-wager-error" : undefined
                    }
                    type="number"
                    step="0.01"
                    placeholder="100"
                    value={wager}
                    onChange={(e) => setWager(e.target.value)}
                    className={`bg-background/50 ${wagerInvalid ? "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-200" : ""}`}
                  />
                  {wagerInvalid && (
                    <p
                      id="tracker-wager-error"
                      className="text-xs font-medium text-red-600"
                      role="alert"
                    >
                      {wagerExceedsWallet && trackerWallet
                        ? `Wager cannot exceed ${formatCurrency(trackerWallet.balance)}.`
                        : "Enter a wager greater than $0."}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-mono uppercase text-muted-foreground">
                    {betMode === "parlay" ? "Combined Odds" : "American Odds *"}
                  </label>
                  <Input
                    aria-invalid={oddsInvalid}
                    aria-describedby={
                      oddsInvalid ? "tracker-odds-error" : undefined
                    }
                    type="text"
                    readOnly={betMode === "parlay"}
                    placeholder="-110"
                    value={
                      betMode === "parlay"
                        ? effectiveOdds
                          ? formatOdds(effectiveOdds)
                          : ""
                        : odds
                    }
                    onChange={(e) => setOdds(e.target.value)}
                    className={`bg-background/50 font-mono ${oddsInvalid ? "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-200" : ""}`}
                  />
                  {oddsInvalid && (
                    <p
                      id="tracker-odds-error"
                      className="text-xs font-medium text-red-600"
                      role="alert"
                    >
                      Enter valid American odds.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-mono uppercase text-muted-foreground">
                  Sportsbook
                </label>
                <SportsbookPicker value={sportsbook} onChange={setSportsbook} />
              </div>

              <ProfitBoostControl
                value={profitBoost}
                onValueChange={setProfitBoost}
              />

              {wager && effectiveOdds !== 0 && (
                <div className="p-3 bg-muted/40 rounded-md border border-border flex justify-between items-center">
                  <span className="text-xs font-mono uppercase text-muted-foreground">
                    Potential Payout
                  </span>
                  <span className="font-mono font-bold text-lg text-green-400">
                    {formatCurrency(potentialPayoutPreview)}
                  </span>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 font-display uppercase tracking-wider"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 font-display uppercase tracking-wider"
                  disabled={createBet.isPending}
                >
                  {createBet.isPending ? "Logging..." : "Log Bet →"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Configure Bet Modal */}
      {configureOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-display uppercase tracking-wider">
                  <Edit2 className="h-5 w-5 text-primary" /> Configure Bet
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Update the bet details or settle its result.
                </p>
              </div>
              <button
                aria-label="Close configure bet dialog"
                onClick={() => setConfigureOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-red-500 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <BetModeToggle
                value={configuredMode}
                onChange={setConfiguredMode}
              />
              <div className="space-y-2">
                <label className="text-xs font-mono uppercase text-muted-foreground">
                  Bet Name *
                </label>
                <Input
                  aria-label="Bet Name"
                  aria-invalid={configuredDescriptionInvalid}
                  aria-describedby={
                    configuredDescriptionInvalid
                      ? "tracker-config-name-error"
                      : undefined
                  }
                  value={configuredDescription}
                  onChange={(event) =>
                    setConfiguredDescription(event.target.value)
                  }
                  className={`bg-background/50 ${configuredDescriptionInvalid ? "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-200" : ""}`}
                />
                {configuredDescriptionInvalid && (
                  <p
                    id="tracker-config-name-error"
                    className="text-xs font-medium text-red-600"
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

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-xs font-mono uppercase text-muted-foreground">
                    Wager ($) *
                  </label>
                  <Input
                    aria-invalid={configuredWagerInvalid}
                    aria-describedby={
                      configuredWagerInvalid
                        ? "tracker-config-wager-error"
                        : undefined
                    }
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={configuredWager}
                    onChange={(event) => setConfiguredWager(event.target.value)}
                    className={`bg-background/50 ${configuredWagerInvalid ? "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-200" : ""}`}
                  />
                  {configuredWagerInvalid && (
                    <p
                      id="tracker-config-wager-error"
                      className="text-xs font-medium text-red-600"
                      role="alert"
                    >
                      Enter a wager greater than $0.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-mono uppercase text-muted-foreground">
                    {configuredMode === "parlay"
                      ? "Combined Odds"
                      : "American Odds *"}
                  </label>
                  <Input
                    aria-invalid={configuredOddsInvalid}
                    aria-describedby={
                      configuredOddsInvalid
                        ? "tracker-config-odds-error"
                        : undefined
                    }
                    type={configuredMode === "parlay" ? "text" : "number"}
                    readOnly={configuredMode === "parlay"}
                    value={
                      configuredMode === "parlay"
                        ? formatOdds(calculateParlayOdds(configuredParlayLegs))
                        : configuredOdds
                    }
                    onChange={(event) => setConfiguredOdds(event.target.value)}
                    className={`bg-background/50 font-mono ${configuredOddsInvalid ? "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-200" : ""}`}
                  />
                  {configuredOddsInvalid && (
                    <p
                      id="tracker-config-odds-error"
                      className="text-xs font-medium text-red-600"
                      role="alert"
                    >
                      Enter valid American odds.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-mono uppercase text-muted-foreground">
                    Status
                  </label>
                  <Select
                    value={configuredStatus}
                    onValueChange={(
                      value: "pending" | "won" | "lost" | "push",
                    ) => setConfiguredStatus(value)}
                  >
                    <SelectTrigger className="bg-background/50">
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
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-mono uppercase text-muted-foreground">
                      Sport
                    </label>
                    <Select
                      value={configuredSport}
                      onValueChange={setConfiguredSport}
                    >
                      <SelectTrigger className="bg-background/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NBA">NBA</SelectItem>
                        <SelectItem value="WNBA">WNBA</SelectItem>
                        <SelectItem value="MLB">MLB</SelectItem>
                        <SelectItem value="NFL">NFL</SelectItem>
                        <SelectItem value="NHL">NHL</SelectItem>
                        <SelectItem value="NCAAF">NCAAF</SelectItem>
                        <SelectItem value="NCAAB">NCAAB</SelectItem>
                        <SelectItem value="Soccer">Soccer</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-mono uppercase text-muted-foreground">
                      Type
                    </label>
                    <Select
                      value={configuredType}
                      onValueChange={setConfiguredType}
                    >
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

              <div className="space-y-2">
                <label className="text-xs font-mono uppercase text-muted-foreground">
                  Sportsbook
                </label>
                <SportsbookPicker
                  value={configuredBook}
                  onChange={setConfiguredBook}
                />
              </div>

              <ProfitBoostControl
                value={configuredProfitBoost}
                onValueChange={setConfiguredProfitBoost}
              />

              <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  {deleteConfirm ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-destructive">
                        Remove this bet?
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteConfirm(false)}
                        disabled={configureBusy}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={removeConfiguredBet}
                        disabled={configureBusy}
                      >
                        {configureBusy ? "Removing..." : "Remove"}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setDeleteConfirm(true)}
                      disabled={configureBusy}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Remove Bet
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setConfigureOpen(false)}
                    disabled={configureBusy}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={saveConfiguredBet}
                    disabled={configureBusy}
                  >
                    {configureBusy ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <ShareBetDialog
        bet={shareBet}
        source="tracker"
        onClose={() => setShareBet(null)}
      />
    </div>
  );
}
