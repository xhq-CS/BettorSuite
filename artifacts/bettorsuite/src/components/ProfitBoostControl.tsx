import { useId } from "react";
import { Input } from "@/components/ui/input";

interface ProfitBoostControlProps {
  value: string;
  onValueChange: (value: string) => void;
}

export function ProfitBoostControl({ value, onValueChange }: ProfitBoostControlProps) {
  const id = useId();
  const enabled = value !== "";

  return (
    <div className={`rounded-lg border px-3 py-2 transition-colors ${enabled ? "border-amber-300 bg-amber-50/80" : "border-border bg-muted/20"}`}>
      <div className="flex min-h-8 items-center gap-2.5">
        <img src="/promotions/profit-boost.png" alt="" className="h-7 w-7 shrink-0 object-contain" />
        <div className="min-w-0 flex-1 leading-tight">
          <span className="block text-sm font-semibold text-slate-900">Profit Boost</span>
          <span className="block text-[11px] text-muted-foreground">Boosts profit only</span>
        </div>
        {enabled && (
          <div className="relative w-20 shrink-0">
            <label htmlFor={id} className="sr-only">Boost percentage</label>
            <Input
              id={id}
              type="number"
              min="0"
              max="1000"
              step="0.01"
              inputMode="decimal"
              value={value}
              onChange={(event) => onValueChange(event.target.value)}
              className="h-8 border-amber-300 bg-white px-2 pr-6 text-right font-mono text-sm font-semibold focus-visible:ring-amber-400"
              aria-label="Profit boost percentage"
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 font-mono text-xs font-semibold text-amber-800">%</span>
          </div>
        )}
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => onValueChange(enabled ? "" : "25")}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 ${enabled ? "bg-amber-400" : "bg-slate-300"}`}
        >
          <span
            className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform duration-200 ${enabled ? "translate-x-5" : "translate-x-0"}`}
          />
          <span className="sr-only">{enabled ? "Remove profit boost" : "Add profit boost"}</span>
        </button>
      </div>
    </div>
  );
}
