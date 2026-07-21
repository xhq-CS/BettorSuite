/**
 * BetCalendar — monthly calendar log for bets
 *
 * Props:
 *   bets   – array of bet objects (real or simulator)
 *   label  – optional label shown in the header (e.g. "Tracker" | "Simulator")
 */
import { useState, useMemo, useEffect } from "react";
import {
  startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, format, addMonths, subMonths,
  isSameDay, isToday, parseISO,
} from "date-fns";
import { ChevronLeft, ChevronRight, CalendarDays, X } from "lucide-react";
import { formatCurrency, formatOdds } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Bet {
  id: number;
  status: "won" | "lost" | "push" | "pending" | "void";
  wager: number;
  potentialPayout?: number | null;
  actualPayout?: number | null;
  createdAt: string;
  description?: string;
  odds?: number;
  sport?: string | null;
  betType?: string;
}

interface DayStat {
  wins:    number;
  losses:  number;
  pushes:  number;
  pending: number;
  profit:  number;   // net $ from settled bets
  wagered: number;   // $ wagered on settled bets
}

interface Props {
  bets:  Bet[];
  label?: string;
  showDayDetails?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function betProfit(bet: Bet): number {
  if (bet.status === "won")  return (bet.actualPayout ?? bet.potentialPayout ?? 0) - bet.wager;
  if (bet.status === "lost") return -bet.wager;
  if (bet.status === "push") return 0;
  return 0;
}

function computeDay(dayBets: Bet[]): DayStat {
  let wins = 0, losses = 0, pushes = 0, pending = 0, profit = 0, wagered = 0;
  for (const b of dayBets) {
    if (b.status === "won")     { wins++;    profit += betProfit(b); wagered += b.wager; }
    else if (b.status === "lost"){ losses++;  profit += betProfit(b); wagered += b.wager; }
    else if (b.status === "push"){ pushes++;  wagered += b.wager; }
    else                          pending++;
  }
  return { wins, losses, pushes, pending, profit, wagered };
}

// Weekday order: Mon(0) … Sun(6)  — getDay returns 0=Sun, so we rotate
function mondayIndex(date: Date): number {
  const d = getDay(date);   // 0=Sun … 6=Sat
  return d === 0 ? 6 : d - 1;
}

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ── Cell colour ────────────────────────────────────────────────────────────────
function cellColor(stat: DayStat, hasBets: boolean): string {
  if (!hasBets) return "";
  const settled = stat.wins + stat.losses + stat.pushes;
  if (settled === 0 && stat.pending > 0) return "bg-amber-500/8 border-amber-500/20";
  if (settled === 0) return "";
  if (stat.profit > 0.49)  return "bg-green-500/12 border-green-500/25";
  if (stat.profit < -0.49) return "bg-red-500/12 border-red-500/25";
  return "bg-amber-500/8 border-amber-500/20";   // near-zero
}

function profitColor(profit: number): string {
  if (profit > 0.49)  return "text-green-400";
  if (profit < -0.49) return "text-red-400";
  return "text-amber-400";
}

// ── Component ──────────────────────────────────────────────────────────────────
export function BetCalendar({ bets, label, showDayDetails = false }: Props) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedDay) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) setSelectedDay(null);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [selectedDay]);

  // Group bets by calendar date string "yyyy-MM-dd"
  const betsByDay = useMemo(() => {
    const map = new Map<string, Bet[]>();
    for (const b of bets) {
      try {
        const key = format(parseISO(b.createdAt), "yyyy-MM-dd");
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(b);
      } catch { /* skip malformed dates */ }
    }
    return map;
  }, [bets]);

  // Month summary
  const monthSummary = useMemo(() => {
    const start = format(month, "yyyy-MM");
    let wins = 0, losses = 0, pushes = 0, profit = 0, wagered = 0;
    for (const [key, dayBets] of betsByDay) {
      if (!key.startsWith(start)) continue;
      const s = computeDay(dayBets);
      wins    += s.wins;
      losses  += s.losses;
      pushes  += s.pushes;
      profit  += s.profit;
      wagered += s.wagered;
    }
    const roi = wagered > 0 ? (profit / wagered) * 100 : 0;
    return { wins, losses, pushes, profit, roi };
  }, [betsByDay, month]);

  const days    = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const leadIn  = mondayIndex(days[0]);   // blank cells before day 1

  // Total cells: pad to complete weeks
  const totalCells = leadIn + days.length;
  const trailingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);

  const goToToday = () => setMonth(startOfMonth(new Date()));
  const selectedDayBets = selectedDay ? betsByDay.get(selectedDay) ?? [] : [];

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg px-1 py-0.5 border border-border">
          <button
            onClick={() => setMonth(m => subMonths(m, 1))}
            className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-2 text-sm font-mono font-semibold w-28 text-center">
            {format(month, "MMM yyyy")}
          </span>
          <button
            onClick={() => setMonth(m => addMonths(m, 1))}
            className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={goToToday}
          className="px-3 py-1.5 text-xs font-semibold border border-border rounded-lg hover:bg-muted transition-colors"
        >
          Today / Latest
        </button>

        {/* Month summary badges */}
        <div className="ml-auto flex items-center gap-3 text-xs">
          <span className="font-mono">
            <span className="text-green-400 font-bold">{monthSummary.wins}W</span>
            {" "}<span className="text-muted-foreground">·</span>{" "}
            <span className="text-red-400 font-bold">{monthSummary.losses}L</span>
            {" "}<span className="text-muted-foreground">·</span>{" "}
            <span className="text-muted-foreground">{monthSummary.pushes}P</span>
          </span>
          <span className={`font-mono font-bold ${profitColor(monthSummary.profit)}`}>
            {monthSummary.profit >= 0 ? "+" : ""}{formatCurrency(monthSummary.profit)}
          </span>
          {monthSummary.roi !== 0 && (
            <span className={`font-mono ${profitColor(monthSummary.roi)}`}>
              {monthSummary.roi >= 0 ? "+" : ""}{monthSummary.roi.toFixed(1)}% ROI
            </span>
          )}
        </div>
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl border border-border overflow-hidden">
        {/* Day-of-week header */}
        <div className="grid grid-cols-7 border-b border-border bg-muted/30">
          {DOW.map(d => (
            <div key={d} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-border last:border-r-0">
              {d}
            </div>
          ))}
        </div>

        {/* Weeks */}
        <div className="grid grid-cols-7">
          {/* Lead-in blanks */}
          {Array.from({ length: leadIn }).map((_, i) => (
            <div key={`lead-${i}`} className="min-h-[90px] border-r border-b border-border/50 last:border-r-0 bg-muted/5" />
          ))}

          {/* Day cells */}
          {days.map(day => {
            const key      = format(day, "yyyy-MM-dd");
            const dayBets  = betsByDay.get(key) ?? [];
            const hasBets  = dayBets.length > 0;
            const stat     = computeDay(dayBets);
            const settled  = stat.wins + stat.losses + stat.pushes;
            const roi      = stat.wagered > 0 ? (stat.profit / stat.wagered) * 100 : 0;
            const todayDay = isToday(day);
            const color    = cellColor(stat, hasBets);

            return (
              <button
                type="button"
                key={key}
                onClick={() => { if (showDayDetails && hasBets) setSelectedDay(key); }}
                disabled={!showDayDetails || !hasBets}
                aria-label={hasBets ? `View ${dayBets.length} bet${dayBets.length === 1 ? "" : "s"} from ${format(day, "MMMM d")}` : format(day, "MMMM d")}
                className={`min-h-[90px] border-r border-b border-border/50 last:border-r-0 p-2 flex flex-col gap-0.5 text-left transition-colors ${showDayDetails && hasBets ? "cursor-pointer hover:ring-2 hover:ring-inset hover:ring-primary/30 hover:bg-primary/5" : "cursor-default"} ${color}`}
              >
                {/* Day number */}
                <div className={`text-xs font-mono font-semibold self-start w-5 h-5 flex items-center justify-center rounded-full ${
                  todayDay ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}>
                  {format(day, "d")}
                </div>

                {hasBets && settled > 0 && (
                  <>
                    {/* W-L-P record */}
                    <div className="text-[11px] font-mono font-semibold text-foreground leading-tight mt-0.5">
                      {stat.wins}-{stat.losses}-{stat.pushes}
                    </div>
                    {/* Profit */}
                    <div className={`text-[11px] font-mono font-semibold leading-tight ${profitColor(stat.profit)}`}>
                      {stat.profit >= 0 ? "+" : ""}{formatCurrency(stat.profit)}
                    </div>
                    {/* ROI */}
                    <div className={`text-[10px] font-mono leading-tight ${profitColor(roi)}`}>
                      {roi >= 0 ? "+" : ""}{roi.toFixed(1)}%
                    </div>
                  </>
                )}

                {hasBets && settled === 0 && stat.pending > 0 && (
                  <div className="text-[10px] font-mono text-amber-400 mt-0.5 leading-tight">
                    {stat.pending} pending
                  </div>
                )}

                {!hasBets && (
                  <div className="mt-1 text-[10px] text-muted-foreground/30 font-mono">—</div>
                )}
              </button>
            );
          })}

          {/* Trailing blanks */}
          {Array.from({ length: trailingCells }).map((_, i) => (
            <div key={`trail-${i}`} className="min-h-[90px] border-r border-b border-border/50 last:border-r-0 bg-muted/5" />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-green-500/20 border border-green-500/40 inline-block" />
          Profit day
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-red-500/20 border border-red-500/40 inline-block" />
          Loss day
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-amber-500/15 border border-amber-500/30 inline-block" />
          Break-even / pending
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-muted/30 border border-border inline-block" />
          No action
        </span>
      </div>

      {selectedDay && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 backdrop-blur-sm p-4">
        <div className="w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-2xl border border-border bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b px-5 py-4"><div><h3 className="text-lg font-semibold">Bets from {format(parseISO(selectedDay), "MMMM d, yyyy")}</h3><p className="text-sm text-muted-foreground mt-0.5">{selectedDayBets.length} {selectedDayBets.length === 1 ? "bet" : "bets"} placed</p></div><button type="button" onClick={() => setSelectedDay(null)} className="h-8 w-8 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 hover:text-red-600" aria-label="Close day details"><X className="w-4 h-4" /></button></div>
          <div className="max-h-[60vh] overflow-y-auto p-5 space-y-3">
            {selectedDayBets.map(bet => {
              const winnings = bet.status === "won" ? (bet.actualPayout ?? bet.potentialPayout ?? 0) - bet.wager : bet.status === "lost" ? -bet.wager : 0;
              return <div key={bet.id} className="rounded-xl border border-border p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-semibold text-slate-900">{bet.description ?? "Bet"}</div><div className="text-xs text-muted-foreground mt-1">{[bet.sport, bet.betType].filter(Boolean).join(" · ")}</div></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${bet.status === "won" ? "bg-emerald-50 text-emerald-700" : bet.status === "lost" ? "bg-red-50 text-red-700" : bet.status === "push" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-700"}`}>{bet.status}</span></div><div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm"><div><div className="text-xs text-muted-foreground">Wager</div><div className="font-mono font-semibold">{formatCurrency(bet.wager)}</div></div><div><div className="text-xs text-muted-foreground">Odds</div><div className="font-mono font-semibold">{bet.odds == null ? "—" : formatOdds(bet.odds)}</div></div><div><div className="text-xs text-muted-foreground">Winnings</div><div className={`font-mono font-semibold ${winnings > 0 ? "text-emerald-700" : winnings < 0 ? "text-red-600" : ""}`}>{winnings > 0 ? "+" : ""}{formatCurrency(winnings)}</div></div><div><div className="text-xs text-muted-foreground">Total payout</div><div className="font-mono font-semibold">{formatCurrency(bet.status === "pending" ? bet.potentialPayout ?? 0 : bet.actualPayout ?? 0)}</div></div></div></div>;
            })}
          </div>
        </div>
      </div>}
    </div>
  );
}
