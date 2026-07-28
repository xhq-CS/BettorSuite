import { pgTable, serial, integer, text, numeric, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const betsTable = pgTable("bets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id).notNull(),
  description: text("description").notNull(),
  betType: text("bet_type").notNull(), // straight, parlay, teaser, prop, etc.
  sportsbook: text("sportsbook"),
  wager: numeric("wager").notNull(),
  odds: numeric("odds").notNull(), // American odds
  parlayLegs: jsonb("parlay_legs").$type<Array<{ description: string; odds: number; sport: string; betType: string }>>().notNull().default([]),
  profitBoostPercent: numeric("profit_boost_percent").notNull().default("0"),
  potentialPayout: numeric("potential_payout").notNull(),
  payoutOverride: numeric("payout_override"),
  actualPayout: numeric("actual_payout"),
  status: text("status").notNull().default("pending"), // pending, won, lost, push, void
  // False preserves the historical wallet behavior for bets created before wagers were reserved.
  walletReserved: boolean("wallet_reserved").notNull().default(false),
  sport: text("sport"),
  playerName: text("player_name"),
  notes: text("notes"),
  betDate: timestamp("bet_date").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  settledAt: timestamp("settled_at"),
});

export const insertBetSchema = createInsertSchema(betsTable).omit({ id: true, createdAt: true });
export type InsertBet = z.infer<typeof insertBetSchema>;
export type Bet = typeof betsTable.$inferSelect;
