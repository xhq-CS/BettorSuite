import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { betTypesForSport } from "@/lib/betting-options";
import { SportInput } from "@/components/SportInput";
import { calculateParlayOdds, formatOdds } from "@/lib/utils";

export interface ParlayLegDraft {
  key: string;
  description: string;
  odds: string;
  sport: string;
  betType: string;
}

export interface ParlayLeg {
  description: string;
  odds: number;
  sport: string;
  betType: string;
}

function legKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function emptyLeg(sport = "NBA"): ParlayLegDraft {
  return { key: legKey(), description: "", odds: "", sport, betType: "player_prop" };
}

export function createParlayLegs(): ParlayLegDraft[] {
  return [emptyLeg(), emptyLeg()];
}

export function toParlayDrafts(legs?: ParlayLeg[] | null): ParlayLegDraft[] {
  if (!legs || legs.length < 2) return createParlayLegs();
  return legs.map((leg) => ({ key: legKey(), ...leg, odds: String(leg.odds) }));
}

export function validParlayLegs(legs: ParlayLegDraft[]): ParlayLeg[] | null {
  if (legs.length < 2) return null;
  const normalized = legs.map((leg) => ({
    description: leg.description.trim(),
    odds: Number(leg.odds),
    sport: leg.sport,
    betType: leg.betType,
  }));
  return normalized.every(
    (leg) =>
      leg.description &&
      leg.sport &&
      leg.betType &&
      Number.isFinite(leg.odds) &&
      leg.odds !== 0,
  )
    ? normalized
    : null;
}

export function ParlayLegEditor({
  legs,
  onChange,
  showErrors = false,
}: {
  legs: ParlayLegDraft[];
  onChange: (legs: ParlayLegDraft[]) => void;
  showErrors?: boolean;
}) {
  const updateLeg = (index: number, update: Partial<ParlayLegDraft>) => {
    onChange(
      legs.map((leg, legIndex) =>
        legIndex === index ? { ...leg, ...update } : leg,
      ),
    );
  };
  const combinedOdds = calculateParlayOdds(legs);
  const hasErrors = showErrors && !validParlayLegs(legs);

  return (
    <div
      className={`space-y-2.5 rounded-xl border bg-blue-50/40 p-3 transition-colors ${hasErrors ? "border-red-400 ring-2 ring-red-100" : "border-blue-200"}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-mono font-semibold uppercase tracking-wider text-blue-800">
            Parlay Legs
          </div>
          <div className="text-[11px] text-muted-foreground">
            Every selection must win.
          </div>
        </div>
        <div className="rounded-md border border-blue-200 bg-white px-2.5 py-1 text-right">
          <div className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
            Combined Odds
          </div>
          <div className="font-mono text-sm font-bold text-blue-700">
            {combinedOdds ? formatOdds(combinedOdds) : "—"}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {legs.map((leg, index) => {
          const descriptionInvalid = showErrors && !leg.description.trim();
          const oddsNumber = Number(leg.odds);
          const oddsInvalid =
            showErrors &&
            (!leg.odds || !Number.isFinite(oddsNumber) || oddsNumber === 0);
          const legInvalid = descriptionInvalid || oddsInvalid;
          const errorId = `parlay-leg-${leg.key}-error`;
          return (
            <div
              key={leg.key}
              className={`rounded-lg border bg-white p-2.5 shadow-sm transition-colors ${legInvalid ? "border-red-300" : "border-border"}`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
                  Leg {index + 1}
                </span>
                <button
                  type="button"
                  aria-label={`Remove leg ${index + 1}`}
                  disabled={legs.length <= 2}
                  onClick={() =>
                    onChange(legs.filter((_, legIndex) => legIndex !== index))
                  }
                  className="rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-25"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <Input
                aria-label={`Leg ${index + 1} selection`}
                aria-invalid={descriptionInvalid}
                aria-describedby={legInvalid ? errorId : undefined}
                placeholder="Selection, e.g. Jayson Tatum over 27.5 points"
                value={leg.description}
                onChange={(event) =>
                  updateLeg(index, { description: event.target.value })
                }
                className={`mb-2 h-9 bg-slate-50 ${descriptionInvalid ? "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-200" : ""}`}
              />
              <div className="grid grid-cols-3 gap-2">
                <SportInput id={`leg-${leg.key}-sport`} value={leg.sport} onChange={(sport) => updateLeg(index, { sport, betType: betTypesForSport(sport)[0]?.value ?? "other" })} />
                <Select
                  value={leg.betType}
                  onValueChange={(betType) => updateLeg(index, { betType })}
                >
                  <SelectTrigger
                    aria-label={`Leg ${index + 1} bet type`}
                    className="h-9 bg-slate-50 px-2"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {betTypesForSport(leg.sport).filter((option) => !["parlay", "same_game_parlay", "round_robin"].includes(option.value)).map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  aria-label={`Leg ${index + 1} American odds`}
                  aria-invalid={oddsInvalid}
                  aria-describedby={legInvalid ? errorId : undefined}
                  type="number"
                  placeholder="-110"
                  value={leg.odds}
                  onChange={(event) =>
                    updateLeg(index, { odds: event.target.value })
                  }
                  className={`h-9 bg-slate-50 px-2 font-mono ${oddsInvalid ? "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-200" : ""}`}
                />
              </div>
              {legInvalid && (
                <p
                  id={errorId}
                  className="mt-2 text-[11px] font-medium text-red-600"
                  role="alert"
                >
                  Add a selection and valid American odds for this leg.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {hasErrors && (
        <p className="text-[11px] font-medium text-red-600" role="alert">
          Complete every highlighted parlay leg before continuing.
        </p>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full border-dashed bg-white text-blue-700 hover:bg-blue-50 hover:text-blue-800"
        disabled={legs.length >= 20}
        onClick={() => onChange([...legs, emptyLeg(legs.at(-1)?.sport)])}
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Leg
      </Button>
    </div>
  );
}
