import {
  pgTable, serial, text, integer, numeric,
  timestamp, jsonb, uniqueIndex,
} from "drizzle-orm/pg-core";

// ── Odds cache — populated by the 5am daily sync ─────────────────
// One row per (sport, market, player_name); upserted each sync.
export const oddsCacheTable = pgTable(
  "odds_cache",
  {
    id:          serial("id").primaryKey(),
    sport:       text("sport").notNull(),        // "basketball_wnba"
    market:      text("market").notNull(),        // "player_points"
    playerName:  text("player_name").notNull(),
    line:        numeric("line").notNull(),
    overOdds:    integer("over_odds"),
    underOdds:   integer("under_odds"),
    book:        text("book").notNull(),
    eventLabel:  text("event_label"),
    fetchedAt:   timestamp("fetched_at").defaultNow().notNull(),
  },
  (t) => [
    // line included so alternate markets can store multiple lines per player
    uniqueIndex("odds_cache_uq").on(t.sport, t.market, t.playerName, t.line),
  ],
);

// ── Player stats cache — populated by the 5am daily sync ─────────
// Official season averages from API-Sports, one row per
// (sport, player_name, season); upserted each sync.
export const playerStatsCacheTable = pgTable(
  "player_stats_cache",
  {
    id:           serial("id").primaryKey(),
    sport:        text("sport").notNull(),         // "NBA"
    playerName:   text("player_name").notNull(),
    apiPlayerId:  integer("api_player_id"),
    teamName:     text("team_name"),
    position:     text("position"),
    season:       integer("season").notNull(),
    statsJson:    jsonb("stats_json").notNull(),
    fetchedAt:    timestamp("fetched_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("player_stats_cache_uq").on(t.sport, t.playerName, t.season),
  ],
);

// ── Sync log — one row per sync run ─────────────────────────────
export const syncLogTable = pgTable("sync_log", {
  id:           serial("id").primaryKey(),
  syncType:     text("sync_type").notNull(),     // "scheduled_5am" | "manual"
  status:       text("status").notNull(),         // "success" | "partial" | "failed"
  oddsRecords:  integer("odds_records").default(0),
  statsRecords: integer("stats_records").default(0),
  errors:       text("errors"),
  startedAt:    timestamp("started_at").defaultNow().notNull(),
  completedAt:  timestamp("completed_at"),
});
