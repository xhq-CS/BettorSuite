export const SPORT_OPTIONS = [
  "NBA", "WNBA", "NCAA Basketball", "NFL", "NCAA Football", "MLB", "NHL",
  "MLS", "EPL", "UEFA Champions League", "Soccer", "Tennis", "Golf",
  "UFC / MMA", "Boxing", "Formula 1", "NASCAR", "Esports", "Other",
] as const;

export const BET_TYPE_OPTIONS = [
  { value: "player_prop", label: "Player Prop" },
  { value: "game_prop", label: "Game Prop" },
  { value: "moneyline", label: "Moneyline" },
  { value: "three_way_moneyline", label: "3-Way Moneyline" },
  { value: "spread", label: "Point Spread" },
  { value: "run_line", label: "Run Line" },
  { value: "puck_line", label: "Puck Line" },
  { value: "total", label: "Game Total" },
  { value: "team_total", label: "Team Total" },
  { value: "first_half", label: "1st Half" },
  { value: "first_quarter", label: "1st Quarter" },
  { value: "first_five", label: "First 5 Innings" },
  { value: "period", label: "Period Bet" },
  { value: "draw_no_bet", label: "Draw No Bet" },
  { value: "both_teams_score", label: "Both Teams to Score" },
  { value: "corners", label: "Corners" },
  { value: "set_betting", label: "Set Betting" },
  { value: "games_spread", label: "Games Spread" },
  { value: "method", label: "Method of Victory" },
  { value: "round", label: "Round Betting" },
  { value: "top_finish", label: "Top Finish" },
  { value: "matchup", label: "Matchup" },
  { value: "map", label: "Map Bet" },
  { value: "series", label: "Series Bet" },
  { value: "futures", label: "Futures / Outright" },
  { value: "parlay", label: "Parlay" },
  { value: "same_game_parlay", label: "Same Game Parlay" },
  { value: "teaser", label: "Teaser" },
  { value: "round_robin", label: "Round Robin" },
  { value: "other", label: "Other" },
] as const;

const values = (...items: string[]) => items;
const COMMON = values("moneyline", "spread", "total", "team_total", "game_prop", "futures", "parlay", "same_game_parlay", "round_robin", "other");

export function betTypesForSport(sport?: string | null) {
  const normalized = (sport ?? "").toLowerCase();
  let allowed = COMMON;
  if (/nba|wnba|basketball/.test(normalized)) allowed = [...COMMON, "player_prop", "first_half", "first_quarter"];
  else if (/nfl|football/.test(normalized)) allowed = [...COMMON, "player_prop", "first_half", "first_quarter", "teaser"];
  else if (/mlb|baseball/.test(normalized)) allowed = values("moneyline", "run_line", "total", "team_total", "player_prop", "first_five", "futures", "parlay", "same_game_parlay", "other");
  else if (/nhl|hockey/.test(normalized)) allowed = values("moneyline", "puck_line", "total", "team_total", "player_prop", "period", "futures", "parlay", "same_game_parlay", "other");
  else if (/mls|epl|soccer|uefa/.test(normalized)) allowed = values("three_way_moneyline", "moneyline", "spread", "total", "team_total", "player_prop", "draw_no_bet", "both_teams_score", "corners", "futures", "parlay", "other");
  else if (/tennis/.test(normalized)) allowed = values("moneyline", "set_betting", "games_spread", "total", "futures", "parlay", "other");
  else if (/golf/.test(normalized)) allowed = values("futures", "top_finish", "matchup", "player_prop", "other");
  else if (/ufc|mma|boxing/.test(normalized)) allowed = values("moneyline", "method", "round", "total", "futures", "parlay", "other");
  else if (/formula|nascar/.test(normalized)) allowed = values("futures", "top_finish", "matchup", "other");
  else if (/esports/.test(normalized)) allowed = values("moneyline", "map", "series", "spread", "total", "player_prop", "parlay", "other");
  return BET_TYPE_OPTIONS.filter((option) => allowed.includes(option.value));
}

export function formatBetType(value?: string | null) {
  if (!value) return "—";
  return BET_TYPE_OPTIONS.find(option => option.value === value)?.label
    ?? value.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());
}
