import { useEffect, useMemo, useRef, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isSameDay,
  isToday,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type BetDatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

const weekdays = ["M", "T", "W", "T", "F", "S", "S"];

function mondayIndex(date: Date) {
  const day = getDay(date);
  return day === 0 ? 6 : day - 1;
}

function safeDate(value: string) {
  try {
    return value ? parseISO(value) : new Date();
  } catch {
    return new Date();
  }
}

export function BetDatePicker({
  value,
  onChange,
  className,
}: BetDatePickerProps) {
  const selectedDate = safeDate(value);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => startOfMonth(selectedDate));
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") setOpen(false);
        return;
      }
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfMonth(month),
        end: endOfMonth(month),
      }),
    [month],
  );
  const leadIn = mondayIndex(days[0]);

  const chooseDate = (date: Date) => {
    onChange(format(date, "yyyy-MM-dd"));
    setMonth(startOfMonth(date));
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => {
          setMonth(startOfMonth(selectedDate));
          setOpen((current) => !current);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-white px-3 text-left text-sm",
          "transition-colors hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary",
        )}
      >
        <span className="font-medium text-slate-800">
          {format(selectedDate, "MMM d, yyyy")}
        </span>
        <CalendarDays className="h-4 w-4 text-slate-400" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose bet date"
          className="absolute left-0 top-[calc(100%+8px)] z-[70] w-[292px] rounded-xl border border-slate-200 bg-white p-3 shadow-[0_18px_50px_rgba(15,23,42,0.14)]"
        >
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMonth((current) => subMonths(current, 1))}
              aria-label="Previous month"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-sm font-semibold text-slate-900">
              {format(month, "MMMM yyyy")}
            </div>
            <button
              type="button"
              onClick={() => setMonth((current) => addMonths(current, 1))}
              aria-label="Next month"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7">
            {weekdays.map((weekday, index) => (
              <div
                key={`${weekday}-${index}`}
                className="flex h-7 items-center justify-center text-[10px] font-semibold uppercase text-slate-400"
              >
                {weekday}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-1">
            {Array.from({ length: leadIn }).map((_, index) => (
              <div key={`blank-${index}`} className="h-9" />
            ))}
            {days.map((day) => {
              const selected = isSameDay(day, selectedDate);
              const today = isToday(day);
              return (
                <button
                  type="button"
                  key={day.toISOString()}
                  onClick={() => chooseDate(day)}
                  aria-label={format(day, "MMMM d, yyyy")}
                  aria-pressed={selected}
                  className={cn(
                    "mx-auto flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-colors",
                    selected
                      ? "bg-primary text-white shadow-sm"
                      : "text-slate-700 hover:bg-blue-50 hover:text-primary",
                    today &&
                      !selected &&
                      "border border-primary/30 font-semibold text-primary",
                  )}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>

          <div className="mt-3 border-t border-slate-100 pt-2">
            <button
              type="button"
              onClick={() => chooseDate(new Date())}
              className="w-full rounded-lg py-2 text-xs font-semibold text-primary transition-colors hover:bg-blue-50"
            >
              Choose today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
