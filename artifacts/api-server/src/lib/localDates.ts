const APP_TIME_ZONE = "America/New_York";

export function localDateKey(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function parseOptionalBetDate(value: unknown): Date {
  if (value === undefined || value === null || value === "") return new Date();
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00-04:00`);
  if (Number.isNaN(date.getTime())) throw new Error("Choose a valid bet date");
  return date;
}

export function rangeStart(range: string, now = new Date()): Date | null {
  const key = localDateKey(now);
  const today = new Date(`${key}T00:00:00-04:00`);
  if (range === "today") return today;
  if (range === "week") {
    const day = today.getDay();
    today.setDate(today.getDate() - ((day + 6) % 7));
    return today;
  }
  if (range === "month") {
    today.setDate(1);
    return today;
  }
  return null;
}
