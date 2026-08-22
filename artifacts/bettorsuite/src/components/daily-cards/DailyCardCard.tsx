import { memo } from "react";
import { CalendarDays, Layers3, Radio, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ParlayLegsSummary } from "@/components/ParlayLegsSummary";
import type { DailyCard } from "@/lib/social-types";
import type { SharedBetSnapshot } from "@/components/shared-bets/SharedBetCard";

interface DailyCardCardProps {
  card: DailyCard;
  compact?: boolean;
  onTail?: (pick: SharedBetSnapshot) => void;
  onDelete?: (card: DailyCard) => void;
}

export const DailyCardCard = memo(function DailyCardCard({
  card,
  compact = false,
  onTail,
  onDelete,
}: DailyCardCardProps) {
  const openPicks = card.picks.filter((pick) => pick.status === "pending").length;
  return (
    <article className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm shadow-black/10">
      <header className="relative overflow-hidden border-b border-border/60 bg-[#080f1f] px-4 py-3 text-white">
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-blue-300">
              <Layers3 className="h-3.5 w-3.5" /> Daily Card
            </div>
            <h3 className="mt-1 truncate text-base font-bold">{card.title}</h3>
            <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
              <CalendarDays className="h-3 w-3" />
              {new Date(card.cardDate).toLocaleDateString([], {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              <span>·</span>
              <span>{card.picks.length} picks</span>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="min-w-12 rounded-lg border border-blue-400/20 bg-blue-400/10 px-2.5 py-1.5 text-center">
              <div className="text-[9px] uppercase tracking-wider text-blue-200">Live</div>
              <div className="font-mono text-sm font-bold">{openPicks}</div>
            </div>
            {onDelete && (
              <button type="button" onClick={() => onDelete(card)} aria-label="Delete daily card" className="flex h-8 w-8 items-center justify-center rounded-lg text-red-300 hover:bg-white/10 hover:text-red-200">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="border-b border-border/50 bg-muted/10 px-4 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Avatar className="h-7 w-7 border border-border">
              <AvatarImage src={card.avatarUrl ?? undefined} alt="" />
              <AvatarFallback className="text-[9px] font-bold">
                {card.username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-xs font-semibold text-foreground">
              @{card.username}
            </span>
          </div>
          <div className="flex flex-wrap justify-end gap-1">
            {card.leagues.map((league) => (
              <span
                key={league}
                className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300"
              >
                {league}
              </span>
            ))}
          </div>
        </div>
        {card.note && (
          <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
            {card.note}
          </p>
        )}
      </div>

      <div className="divide-y divide-border/40">
        {card.picks.map((pick, index) => {
          const canTail = pick.status === "pending" && Boolean(onTail);
          return (
            <div key={pick.originalBetId} className={`px-4 ${compact ? "py-2.5" : "py-3"}`}>
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/40 font-mono text-[10px] font-bold text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    <span>{pick.sport || "Other"}</span>
                    <span>·</span>
                    <span>{pick.betType === "parlay" ? `${pick.parlayLegs?.length ?? 0}-leg parlay` : pick.betType}</span>
                  </div>
                  <div className="mt-0.5 truncate text-sm font-semibold text-foreground">
                    {pick.description}
                  </div>
                </div>
                <div className={`flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${pick.status === "won" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : pick.status === "lost" ? "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300" : pick.status === "pending" ? "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300" : "border-border bg-muted/40 text-muted-foreground"}`}>
                  {pick.status === "pending" ? <Radio className="h-2.5 w-2.5" /> : null}
                  {pick.status === "pending" ? "Pending" : pick.status}
                </div>
                {canTail && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 shrink-0 border-primary/30 bg-primary/10 px-2.5 text-xs text-primary hover:bg-primary/15 hover:text-primary"
                    onClick={() => onTail?.(pick)}
                  >
                    <Zap className="mr-1 h-3 w-3" /> Tail
                  </Button>
                )}
              </div>
              <div className="ml-10">
                <ParlayLegsSummary
                  legs={pick.parlayLegs}
                  isParlay={pick.betType === "parlay"}
                  status={pick.status}
                />
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
});
