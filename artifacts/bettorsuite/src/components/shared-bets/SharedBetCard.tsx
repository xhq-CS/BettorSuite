import {
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Clock3,
  ArrowUpRight,
  Layers3,
  ReceiptText,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { ProfitBoostBadge } from "@/components/ProfitBoostBadge";
import { formatBetType } from "@/lib/betting-options";
import { formatCurrency, formatOdds } from "@/lib/utils";

export interface SharedBetLeg {
  description: string;
  odds: number;
  sport: string;
  betType: string;
}

export interface SharedBetSnapshot {
  source: "tracker" | "mock";
  originalBetId: number;
  description: string;
  betType: string;
  sportsbook: string | null;
  wager: number;
  odds: number;
  parlayLegs: SharedBetLeg[];
  profitBoostPercent: number;
  potentialPayout: number;
  actualPayout: number | null;
  status: string;
  sport: string | null;
  placedAt: string;
  sharedAt: string;
}

const STATUS_DETAILS = {
  pending: {
    label: "Pending Slip",
    action: "Tail this bet",
    icon: Clock3,
    color: "border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  won: {
    label: "Winning Ticket",
    action: "Cashed",
    icon: CheckCircle2,
    color: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  lost: {
    label: "Final",
    action: "Lost",
    icon: XCircle,
    color: "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300",
  },
  push: {
    label: "Final",
    action: "Push",
    icon: RotateCcw,
    color: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
} as const;

interface SharedBetCardProps {
  bet: SharedBetSnapshot;
  compact?: boolean;
  onTail?: (bet: SharedBetSnapshot) => void;
}

export function SharedBetCard({
  bet,
  compact = false,
  onTail,
}: SharedBetCardProps) {
  const status =
    STATUS_DETAILS[bet.status as keyof typeof STATUS_DETAILS] ??
    STATUS_DETAILS.pending;
  const StatusIcon = status.icon;
  const isParlay = bet.betType === "parlay" || bet.parlayLegs.length > 1;
  const settledPayout =
    bet.actualPayout ?? (bet.status === "won" ? bet.potentialPayout : 0);
  const profit =
    bet.status === "won"
      ? settledPayout - bet.wager
      : bet.status === "lost"
        ? -bet.wager
        : 0;
  const valueLabel = bet.status === "pending" ? "To Win" : "Profit";
  const value =
    bet.status === "pending" ? bet.potentialPayout - bet.wager : profit;
  const payoutLabel = bet.status === "pending" ? "Potential" : "Payout";
  const payout = bet.status === "pending" ? bet.potentialPayout : settledPayout;

  return (
    <article
      className={`w-full overflow-hidden border border-border/80 bg-card text-card-foreground ring-1 ring-white/[0.025] ${compact ? "max-w-xl rounded-2xl shadow-[0_10px_28px_rgba(0,0,0,0.20)]" : "rounded-2xl shadow-sm shadow-black/10"}`}
    >
      <div
        className={`flex items-center justify-between gap-3 border-b border-border/60 bg-[#080f1f] text-white ${compact ? "px-3.5 py-2.5" : "px-4 py-2.5"}`}
      >
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em]">
          <ReceiptText className="h-4 w-4 text-blue-300" />
          Shared Bet Slip
        </div>
        <span className="rounded-full border border-border bg-white/[0.06] px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-slate-300">
          {bet.source === "tracker" ? "Book Keeper" : "Mock Betting"}
        </span>
      </div>
      {compact && (
        <div className="h-0.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400" />
      )}

      <div className={compact ? "space-y-3 p-3.5" : "space-y-3 p-4"}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <span>{bet.sport ?? "Sports"}</span>
              <span aria-hidden="true">·</span>
              <span>
                {isParlay
                  ? `${bet.parlayLegs.length || "Multi"}-Leg Parlay`
                  : formatBetType(bet.betType)}
              </span>
              {bet.sportsbook && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{bet.sportsbook}</span>
                </>
              )}
              <ProfitBoostBadge percent={bet.profitBoostPercent} />
            </div>
            <h4
              className={`mt-1 break-words font-bold leading-snug text-slate-950 ${compact ? "text-sm" : "text-base"}`}
            >
              {bet.description}
            </h4>
          </div>
          <div
            className={`shrink-0 rounded-xl border text-center ${compact ? "px-2.5 py-2" : "px-2.5 py-2"} ${status.color}`}
          >
            <StatusIcon className="mx-auto h-4 w-4" />
            <div className="mt-1 text-[9px] font-bold uppercase tracking-wider">
              {status.label}
            </div>
          </div>
        </div>

        {isParlay && bet.parlayLegs.length > 0 && (
          <details className="group overflow-hidden rounded-xl border border-border/70 bg-muted/25">
            <summary
              className={`flex cursor-pointer list-none items-center justify-between gap-3 px-3 text-xs font-semibold text-foreground ${compact ? "py-2" : "py-2.5"}`}
            >
              <span className="flex items-center gap-2">
                <Layers3 className="h-4 w-4 text-blue-600" />
                View all {bet.parlayLegs.length} legs
              </span>
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-2 border-t border-border/60 bg-background/40 p-3">
              {bet.parlayLegs.map((leg, index) => (
                <div
                  key={`${index}-${leg.description}`}
                  className="flex gap-2.5"
                >
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-blue-500/20 bg-blue-500/10 text-[9px] font-bold text-blue-700 dark:text-blue-300">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="break-words text-xs font-semibold text-foreground">
                      {leg.description}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-500">
                      <span>{leg.sport}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatBetType(leg.betType)}</span>
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-xs font-semibold text-foreground">
                    {formatOdds(leg.odds)}
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}

        <div className="grid grid-cols-4 overflow-hidden rounded-xl border border-border/70 bg-muted/25">
          <Metric label="Wager" value={formatCurrency(bet.wager)} compact={compact} />
          <Metric label="Odds" value={formatOdds(bet.odds)} compact={compact} />
          <Metric
            label={valueLabel}
            value={`${value > 0 ? "+" : ""}${formatCurrency(value)}`}
            tone={value > 0 ? "positive" : value < 0 ? "negative" : "neutral"}
            compact={compact}
          />
          <Metric label={payoutLabel} value={formatCurrency(payout)} compact={compact} />
        </div>

        {bet.status === "pending" && onTail ? (
          <button
            type="button"
            onClick={() => onTail(bet)}
            className="group/tail flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-primary transition-all hover:border-primary/45 hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <CircleDot className="h-4 w-4" />
            Tail This Bet
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover/tail:-translate-y-0.5 group-hover/tail:translate-x-0.5" />
          </button>
        ) : (
          <div
            className={`flex items-center justify-center gap-2 rounded-xl border px-3 font-bold uppercase tracking-[0.16em] ${compact ? "py-2 text-[10px]" : "py-2 text-xs"} ${status.color}`}
          >
            {bet.status === "pending" ? (
              <CircleDot className="h-4 w-4" />
            ) : (
              <StatusIcon className="h-4 w-4" />
            )}
            {status.action}
          </div>
        )}
      </div>
    </article>
  );
}

function Metric({
  label,
  value,
  tone = "neutral",
  compact = false,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral";
  compact?: boolean;
}) {
  return (
    <div
      className={`min-w-0 border-r border-border/60 px-2 text-center last:border-r-0 ${compact ? "py-2.5" : "py-2.5"}`}
    >
      <div className="truncate text-[8px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div
        className={`mt-1 truncate font-mono text-[11px] font-bold ${tone === "positive" ? "text-emerald-700 dark:text-emerald-300" : tone === "negative" ? "text-red-700 dark:text-red-300" : "text-foreground"}`}
      >
        {value}
      </div>
    </div>
  );
}
