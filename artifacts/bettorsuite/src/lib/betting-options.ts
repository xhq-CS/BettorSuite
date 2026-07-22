export const BET_TYPE_OPTIONS = [
  { value: "prop", label: "Player Prop" },
  { value: "game_prop", label: "Game Prop" },
  { value: "moneyline", label: "Moneyline" },
  { value: "spread", label: "Point Spread" },
  { value: "total", label: "Game Total" },
  { value: "team_total", label: "Team Total" },
  { value: "first_half", label: "1st Half" },
  { value: "first_quarter", label: "1st Quarter" },
  { value: "futures", label: "Futures" },
  { value: "parlay", label: "Parlay" },
  { value: "same_game_parlay", label: "Same Game Parlay" },
  { value: "teaser", label: "Teaser" },
  { value: "round_robin", label: "Round Robin" },
  { value: "other", label: "Other" },
] as const;

export function formatBetType(value?: string | null) {
  if (!value) return "—";
  return BET_TYPE_OPTIONS.find(option => option.value === value)?.label
    ?? value.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());
}
