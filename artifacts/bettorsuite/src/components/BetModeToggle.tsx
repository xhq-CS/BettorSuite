export function BetModeToggle({ value, onChange }: { value: "straight" | "parlay"; onChange: (value: "straight" | "parlay") => void }) {
  return (
    <div className="grid grid-cols-2 rounded-lg border border-border bg-slate-50 p-1" aria-label="Bet format">
      {(["straight", "parlay"] as const).map(mode => (
        <button key={mode} type="button" onClick={() => onChange(mode)} className={`rounded-md px-3 py-1.5 text-sm font-semibold capitalize transition-all ${value === mode ? "bg-white text-slate-950 shadow-sm ring-1 ring-black/5" : "text-muted-foreground hover:text-slate-900"}`}>
          {mode}
        </button>
      ))}
    </div>
  );
}
