import { pgTable, serial, text, integer, numeric, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const teamsTable = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  city: text("city").notNull(),
  abbreviation: text("abbreviation").notNull(),
  sport: text("sport").notNull(), // NBA, WNBA, MLB
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const playersTable = pgTable("players", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sport: text("sport").notNull(),
  position: text("position").notNull(),
  teamId: integer("team_id").references(() => teamsTable.id),
  number: text("number"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const playerGameStatsTable = pgTable("player_game_stats", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").references(() => playersTable.id).notNull(),
  gameDate: text("game_date").notNull(), // ISO date string
  opponent: text("opponent").notNull(),
  // Basketball stats
  points: numeric("points"),
  rebounds: numeric("rebounds"),
  assists: numeric("assists"),
  steals: numeric("steals"),
  blocks: numeric("blocks"),
  threePointers: numeric("three_pointers"),
  turnovers: numeric("turnovers"),
  minutesPlayed: numeric("minutes_played"),
  // Baseball stats
  hits: numeric("hits"),
  homeRuns: numeric("home_runs"),
  rbis: numeric("rbis"),
  runs: numeric("runs"),
  strikeouts: numeric("strikeouts"),
  walks: numeric("walks"),
  inningsPitched: numeric("innings_pitched"),
  earnedRuns: numeric("earned_runs"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const teamGameStatsTable = pgTable("team_game_stats", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").references(() => teamsTable.id).notNull(),
  gameDate: text("game_date").notNull(),
  opponent: text("opponent").notNull(),
  isHome: boolean("is_home").notNull().default(false),
  score: integer("score"),
  opponentScore: integer("opponent_score"),
  won: boolean("won"),
  // Basketball
  totalPoints: numeric("total_points"),
  totalRebounds: numeric("total_rebounds"),
  totalAssists: numeric("total_assists"),
  threePointersMade: numeric("three_pointers_made"),
  // Baseball
  totalHits: numeric("total_hits"),
  totalRuns: numeric("total_runs"),
  totalHomeRuns: numeric("total_home_runs"),
  errors: numeric("errors"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTeamSchema = createInsertSchema(teamsTable).omit({ id: true, createdAt: true });
export const insertPlayerSchema = createInsertSchema(playersTable).omit({ id: true, createdAt: true });
export const insertPlayerGameStatSchema = createInsertSchema(playerGameStatsTable).omit({ id: true, createdAt: true });
export const insertTeamGameStatSchema = createInsertSchema(teamGameStatsTable).omit({ id: true, createdAt: true });

export type Team = typeof teamsTable.$inferSelect;
export type Player = typeof playersTable.$inferSelect;
export type PlayerGameStat = typeof playerGameStatsTable.$inferSelect;
export type TeamGameStat = typeof teamGameStatsTable.$inferSelect;
