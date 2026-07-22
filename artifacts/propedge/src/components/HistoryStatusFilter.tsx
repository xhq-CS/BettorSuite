import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type HistoryStatusFilterValue =
  | "all"
  | "pending"
  | "won"
  | "lost"
  | "push";

interface HistoryStatusFilterProps {
  value: HistoryStatusFilterValue;
  onValueChange: (value: HistoryStatusFilterValue) => void;
}

export function HistoryStatusFilter({
  value,
  onValueChange,
}: HistoryStatusFilterProps) {
  return (
    <Select
      value={value}
      onValueChange={(nextValue) =>
        onValueChange(nextValue as HistoryStatusFilterValue)
      }
    >
      <SelectTrigger
        aria-label="Filter bet history by result"
        className="h-9 w-full bg-transparent text-sm font-mono sm:w-[150px]"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All results</SelectItem>
        <SelectItem value="pending">Open</SelectItem>
        <SelectItem value="won">Won</SelectItem>
        <SelectItem value="lost">Lost</SelectItem>
        <SelectItem value="push">Push</SelectItem>
      </SelectContent>
    </Select>
  );
}
