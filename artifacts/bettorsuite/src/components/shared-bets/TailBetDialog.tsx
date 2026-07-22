import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getGetBetSummaryQueryKey,
  getGetSimulatorWalletQueryKey,
  getListBetsQueryKey,
  getListSimulatorBetsQueryKey,
} from "@workspace/api-client-react";
import {
  ArrowRight,
  Gamepad2,
  ReceiptText,
  Target,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SportsbookPicker } from "@/components/SportsbookPicker";
import { api } from "@/lib/api";
import { formatBetType } from "@/lib/betting-options";
import {
  calculatePayout,
  formatCurrency,
  formatOdds,
} from "@/lib/utils";
import type { SharedBetSnapshot } from "@/components/shared-bets/SharedBetCard";

type TailDestination = "mock" | "tracker";

interface TailBetDialogProps {
  bet: SharedBetSnapshot | null;
  onClose: () => void;
}

export function TailBetDialog({ bet, onClose }: TailBetDialogProps) {
  const queryClient = useQueryClient();
  const [destination, setDestination] = useState<TailDestination>("mock");
  const [wager, setWager] = useState("");
  const [odds, setOdds] = useState("");
  const [sportsbook, setSportsbook] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const trackerWallet = useQuery({
    queryKey: ["tracker-wallet"],
    queryFn: () => api<{ balance: number }>("/bets/wallet"),
    enabled: Boolean(bet),
  });
  const mockWallet = useQuery({
    queryKey: getGetSimulatorWalletQueryKey(),
    queryFn: () => api<{ balance: number }>("/simulator/wallet"),
    enabled: Boolean(bet),
  });

  useEffect(() => {
    if (!bet) return;
    setDestination("mock");
    setWager(bet.wager.toFixed(2));
    setOdds("");
    setSportsbook(bet.sportsbook ?? "");
    setSubmitted(false);
  }, [bet]);

  useEffect(() => {
    if (!bet) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [bet, onClose]);

  const wagerAmount = Number(wager);
  const validWager = Number.isFinite(wagerAmount) && wagerAmount > 0;
  const oddsProvided = Boolean(odds.trim());
  const oddsAmount = Number(odds);
  const validOdds =
    !oddsProvided || (Number.isFinite(oddsAmount) && oddsAmount !== 0);
  const effectiveOdds = oddsProvided && validOdds ? oddsAmount : (bet?.odds ?? 0);
  const availableBalance =
    destination === "tracker"
      ? trackerWallet.data?.balance
      : mockWallet.data?.balance;
  const walletLoading =
    destination === "tracker" ? trackerWallet.isLoading : mockWallet.isLoading;
  const wagerExceedsBalance =
    validWager &&
    availableBalance !== undefined &&
    wagerAmount > availableBalance;
  const potentialPayout = bet
    ? calculatePayout(wagerAmount, effectiveOdds, bet.profitBoostPercent)
    : 0;

  const tail = useMutation({
    mutationFn: async () => {
      if (!bet || !validWager) throw new Error("Enter a valid wager");
      if (!validOdds) throw new Error("Enter valid American odds or leave them blank");
      if (wagerExceedsBalance) {
        throw new Error(
          destination === "tracker"
            ? "Wager exceeds your tracker wallet balance"
            : "Wager exceeds your virtual bankroll",
        );
      }
      const isParlay = bet.betType === "parlay" || bet.parlayLegs.length > 1;
      const payload = {
        description: bet.description,
        betType: isParlay ? "parlay" : bet.betType,
        wager: wagerAmount,
        odds: effectiveOdds,
        parlayLegs: isParlay ? bet.parlayLegs : undefined,
        profitBoostPercent: bet.profitBoostPercent,
        sport: bet.sport ?? undefined,
        ...(destination === "tracker"
          ? {
              sportsbook: sportsbook.trim() || undefined,
              notes: "Tailed from a shared BettorSuite slip.",
            }
          : {}),
      };

      return api(destination === "tracker" ? "/bets" : "/simulator/bets", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: async () => {
      if (destination === "tracker") {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: getListBetsQueryKey() }),
          queryClient.invalidateQueries({
            queryKey: getGetBetSummaryQueryKey(),
          }),
          queryClient.invalidateQueries({ queryKey: ["tracker-wallet"] }),
        ]);
      } else {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: getListSimulatorBetsQueryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: getGetSimulatorWalletQueryKey(),
          }),
        ]);
      }
      toast.success(
        destination === "tracker"
          ? "Bet added to Book Keeper"
          : "Bet placed in Mock Betting",
      );
      onClose();
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Unable to tail this bet",
      ),
  });

  if (!bet) return null;
  const isParlay = bet.betType === "parlay" || bet.parlayLegs.length > 1;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tail-bet-title"
        className="max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="relative overflow-hidden bg-slate-950 px-5 py-4 text-white">
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-blue-500 via-indigo-400 to-cyan-300" />
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="tail-bet-title" className="flex items-center gap-2 text-lg font-bold">
                <ReceiptText className="h-5 w-5 text-blue-300" />
                Tail This Bet
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Copy the slip into your account and make it yours.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close tail bet"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-red-300 transition-colors hover:bg-white/10 hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <form
          noValidate
          className="space-y-5 p-5"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitted(true);
            if (
              validWager &&
              validOdds &&
              !wagerExceedsBalance &&
              !tail.isPending
            )
              tail.mutate();
          }}
        >
          <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50/80 to-white p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  {bet.sport ?? "Sports"} · {isParlay ? `${bet.parlayLegs.length}-Leg Parlay` : formatBetType(bet.betType)}
                </div>
                <div className="mt-1 truncate text-sm font-bold text-slate-950">
                  {bet.description}
                </div>
              </div>
              <span className="shrink-0 rounded-lg border border-blue-200 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-700">
                Price at your book
              </span>
            </div>
            {isParlay && (
              <div className="mt-2 text-[11px] text-slate-500">
                All {bet.parlayLegs.length} legs will be copied exactly.
              </div>
            )}
          </div>

          <fieldset>
            <legend className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Place It In
            </legend>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setDestination("mock")}
                aria-pressed={destination === "mock"}
                className={`rounded-xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  destination === "mock"
                    ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <Gamepad2 className="h-4 w-4 text-blue-600" />
                <div className="mt-2 text-sm font-bold text-slate-950">
                  Mock Betting
                </div>
                <div className="mt-0.5 text-[11px] leading-4 text-slate-500">
                  Test it with your virtual bankroll
                </div>
                <div className="mt-1 font-mono text-[10px] font-bold text-blue-700">
                  {mockWallet.data
                    ? `${formatCurrency(mockWallet.data.balance)} available`
                    : "Loading balance..."}
                </div>
              </button>
              <button
                type="button"
                onClick={() => setDestination("tracker")}
                aria-pressed={destination === "tracker"}
                className={`rounded-xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  destination === "tracker"
                    ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <Target className="h-4 w-4 text-blue-600" />
                <div className="mt-2 text-sm font-bold text-slate-950">
                  Book Keeper
                </div>
                <div className="mt-0.5 text-[11px] leading-4 text-slate-500">
                  Add it to your tracked action
                </div>
                <div className="mt-1 font-mono text-[10px] font-bold text-blue-700">
                  {trackerWallet.data
                    ? `${formatCurrency(trackerWallet.data.balance)} available`
                    : "Loading balance..."}
                </div>
              </button>
            </div>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="flex h-4 items-center justify-between gap-2">
                <Label htmlFor="tail-wager" className="block text-[10px]">
                  Your Wager *
                </Label>
                {availableBalance !== undefined && (
                  <span className="block font-mono text-[9px] leading-none text-slate-500">
                    Available {formatCurrency(availableBalance)}
                  </span>
                )}
              </div>
              <div className="relative mt-1.5">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                  $
                </span>
                <Input
                  id="tail-wager"
                  autoFocus
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  value={wager}
                  onChange={(event) => setWager(event.target.value)}
                  aria-invalid={
                    submitted && (!validWager || wagerExceedsBalance)
                  }
                  className={`pl-7 font-mono ${
                    submitted && (!validWager || wagerExceedsBalance)
                      ? "border-red-400 ring-2 ring-red-100"
                      : ""
                  }`}
                />
              </div>
              {submitted && (!validWager || wagerExceedsBalance) && (
                <p className="mt-1 text-xs text-red-600" role="alert">
                  {wagerExceedsBalance && availableBalance !== undefined
                    ? `Wager cannot exceed ${formatCurrency(availableBalance)}.`
                    : "Enter a wager above $0."}
                </p>
              )}
            </div>

            <div>
              <div className="flex h-4 items-center justify-between gap-2">
                <Label htmlFor="tail-odds" className="block text-[10px]">
                  Your Odds
                </Label>
                <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                  Optional
                </span>
              </div>
              <Input
                id="tail-odds"
                type="number"
                step="1"
                inputMode="numeric"
                value={odds}
                onChange={(event) => setOdds(event.target.value)}
                placeholder={formatOdds(bet.odds)}
                aria-invalid={submitted && !validOdds}
                className={`mt-1.5 font-mono ${
                  submitted && !validOdds
                    ? "border-red-400 ring-2 ring-red-100"
                    : ""
                }`}
              />
              {submitted && !validOdds ? (
                <p className="mt-1 text-xs text-red-600" role="alert">
                  Enter valid American odds or leave this blank.
                </p>
              ) : (
                <p className="mt-1 text-[10px] text-slate-500">
                  Blank uses the shared price of {formatOdds(bet.odds)}.
                </p>
              )}
            </div>

            {destination === "tracker" ? (
              <div className="sm:col-span-2">
                <div className="flex h-4 items-center">
                  <Label className="block text-[10px]">Sportsbook</Label>
                </div>
                <div className="mt-1.5">
                  <SportsbookPicker
                    value={sportsbook}
                    onChange={setSportsbook}
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 sm:col-span-2">
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                  Virtual Bankroll
                </div>
                <div className="mt-1 text-xs text-slate-600">
                  Your wager is deducted when placed.
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                To Win
              </div>
              <div className="mt-0.5 font-mono text-sm font-bold text-emerald-600">
                {validWager && validOdds
                  ? `+${formatCurrency(potentialPayout - wagerAmount)}`
                  : "$0.00"}
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-300" />
            <div className="text-right">
              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                Potential Payout
              </div>
              <div className="mt-0.5 font-mono text-sm font-bold text-slate-950">
                {validWager && validOdds
                  ? formatCurrency(potentialPayout)
                  : "$0.00"}
              </div>
            </div>
          </div>

          <Button
            type="submit"
            className="h-11 w-full"
            disabled={
              tail.isPending || walletLoading || availableBalance === undefined
            }
          >
            {tail.isPending
              ? "Placing Bet..."
              : destination === "tracker"
                ? "Add to Book Keeper"
                : "Place Mock Bet"}
            {!tail.isPending && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
