import { Input } from "@/components/ui/input";
import { SPORT_OPTIONS } from "@/lib/betting-options";

export function SportInput({ value, onChange, id = "sport-input" }: { value: string; onChange: (value: string) => void; id?: string }) {
  return <>
    <Input list={`${id}-options`} value={value} onChange={(event) => onChange(event.target.value)} placeholder="Choose or type a league" className="bg-background/50" />
    <datalist id={`${id}-options`}>{SPORT_OPTIONS.map((sport) => <option key={sport} value={sport} />)}</datalist>
  </>;
}
