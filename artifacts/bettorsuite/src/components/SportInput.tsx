import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SPORT_OPTIONS } from "@/lib/betting-options";

export function SportInput({ value, onChange, id = "sport-input" }: { value: string; onChange: (value: string) => void; id?: string }) {
  const isPreset = SPORT_OPTIONS.some((sport) => sport === value);
  const presetValue = isPreset ? value : "custom";
  const customValue = isPreset ? "" : value;

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Select
        value={presetValue}
        onValueChange={(nextValue) => onChange(nextValue === "custom" ? "" : nextValue)}
      >
        <SelectTrigger id={id} className="bg-background/50" aria-label="Select a league or sport">
          <SelectValue placeholder="Select league / sport" />
        </SelectTrigger>
        <SelectContent>
          {SPORT_OPTIONS.map((sport) => (
            <SelectItem key={sport} value={sport}>
              {sport}
            </SelectItem>
          ))}
          <SelectItem value="custom">Custom league / sport</SelectItem>
        </SelectContent>
      </Select>
      <Input
        id={`${id}-custom`}
        value={customValue}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Or type a custom league"
        aria-label="Custom league or sport"
        maxLength={80}
        className="bg-background/50"
      />
    </div>
  );
}
