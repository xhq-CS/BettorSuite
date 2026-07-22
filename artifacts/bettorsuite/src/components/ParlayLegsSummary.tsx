import { Check, ChevronDown, Layers3 } from "lucide-react";
import { formatBetType } from "@/lib/betting-options";
import { formatOdds } from "@/lib/utils";
import type { ParlayLeg } from "@/components/ParlayLegEditor";

export function ParlayLegsSummary({ legs, isParlay = false, status }: { legs?: ParlayLeg[] | null; isParlay?: boolean; status?: string }) {
  if (!isParlay && !legs?.length) return null;
  return (
    <details className="group mt-2 rounded-lg border border-blue-100 bg-blue-50/50 text-left">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs font-semibold text-blue-700 [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-1.5"><Layers3 className="h-3.5 w-3.5" /> {legs?.length ? `${legs.length}-Leg Parlay` : "Parlay Details"}</span>
        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-blue-500">View legs <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" /></span>
      </summary>
      <div className="border-t border-blue-100 bg-white px-3 py-3">
        {legs?.length ? (
          <div className="relative space-y-0">
            <div className="absolute bottom-4 left-3 top-4 w-px bg-blue-100" />
            {legs.map((leg, index) => (
              <div key={`${leg.description}-${leg.odds}-${index}`} className="relative flex gap-2.5 pb-3 last:pb-0">
                <span className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-white font-mono text-[10px] font-bold ${status === "won" ? "border-emerald-300 text-emerald-500" : "border-blue-200 text-blue-600"}`}>{status === "won" ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : index + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3"><span className="font-semibold leading-snug text-slate-800">{leg.description}</span><span className="shrink-0 font-mono font-bold text-blue-600">{formatOdds(leg.odds)}</span></div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500">{leg.sport} · {formatBetType(leg.betType)}</div>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-xs leading-relaxed text-slate-500">Individual leg details were not saved for this earlier parlay. You can add them through Configure.</p>}
      </div>
    </details>
  );
}
