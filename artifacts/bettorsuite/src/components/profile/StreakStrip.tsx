import { Check, Minus, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { StreakDay } from "@/lib/social-types";

interface StreakStripProps {
  days?: StreakDay[];
}

export function StreakStrip({ days }: StreakStripProps) {
  const safeDays = Array.isArray(days) ? days : [];

  if (!safeDays.length) {
    return <span className="text-xs text-slate-400">No recent returns</span>;
  }

  return (
    <div
      className="inline-flex items-center gap-1"
      aria-label="Monday-to-Sunday profitability strip"
    >
      {safeDays.map((day) => {
        const weekday = new Intl.DateTimeFormat("en-US", {
          weekday: "narrow",
        }).format(new Date(`${day.date}T12:00:00`));
        const isProfit = day.profit > 0;
        const isLoss = day.profit < 0;
        const resultLabel = isProfit
          ? "Profit"
          : isLoss
            ? "Loss"
            : "No action or break-even";

        return (
          <div
            key={day.date}
            className="flex flex-col items-center gap-1"
            title={`${day.date}: ${resultLabel} (${day.profit >= 0 ? "+" : ""}${formatCurrency(day.profit)})`}
          >
            <span className="text-[9px] font-mono uppercase text-slate-400">
              {weekday}
            </span>
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full border ${isProfit ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : isLoss ? "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300" : "border-border bg-muted/40 text-muted-foreground"}`}
            >
              {isProfit ? (
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              ) : isLoss ? (
                <X className="h-3.5 w-3.5" strokeWidth={2.5} />
              ) : (
                <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
