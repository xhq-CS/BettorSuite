import { Input } from "@/components/ui/input";

const SPORTSBOOKS = [
  { name: "DraftKings", logo: "/sportsbooks/draftkings.avif" },
  { name: "FanDuel", logo: "/sportsbooks/fanduel.jfif" },
] as const;

interface SportsbookPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function SportsbookPicker({
  value,
  onChange,
}: SportsbookPickerProps) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {SPORTSBOOKS.map((book) => {
          const selected =
            value.trim().toLowerCase() === book.name.toLowerCase();
          return (
            <button
              key={book.name}
              type="button"
              onClick={() => onChange(book.name)}
              aria-pressed={selected}
              className={`flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                selected
                  ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/20"
                  : "border-border bg-white text-slate-700 hover:border-primary/40 hover:bg-slate-50"
              }`}
            >
              <img
                src={book.logo}
                alt=""
                className="h-6 w-6 rounded-md border border-slate-200 bg-white object-contain p-0.5"
              />
              {book.name}
            </button>
          );
        })}
      </div>
      <Input
        placeholder="Or enter another sportsbook"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={80}
        className="bg-background/50"
      />
    </div>
  );
}
