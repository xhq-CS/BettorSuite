import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
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
  potentialPayout: numeric("potential_payout").notNull(),
  actualPayout: numeric("actual_payout"),
  status: text("status").notNull().default("pending"), // pending, won, lost, push, void
  sport: text("sport"),
  playerName: text("player_name"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  settledAt: timestamp("settled_at"),
});

export const insertBetSchema = createInsertSchema(betsTable).omit({ id: true, createdAt: true });
export type InsertBet = z.infer<typeof insertBetSchema>;
export type Bet = typeof betsTable.$inferSelect;
