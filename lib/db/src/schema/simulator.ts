import { pgTable, serial, integer, text, numeric, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const simulatorWalletsTable = pgTable("simulator_wallets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id).notNull().unique(),
  balance: numeric("balance").notNull().default("1000"),
  startingBalance: numeric("starting_balance").notNull().default("1000"),
  unitMode: text("unit_mode").notNull().default("auto"),
  customUnitSize: numeric("custom_unit_size").notNull().default("10"),
  totalBets: integer("total_bets").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  totalProfit: numeric("total_profit").notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const simulatorBetsTable = pgTable("simulator_bets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id).notNull(),
  description: text("description").notNull(),
  betType: text("bet_type").notNull(),
  wager: numeric("wager").notNull(),
  odds: numeric("odds").notNull(),
  parlayLegs: jsonb("parlay_legs").$type<Array<{ description: string; odds: number; sport: string; betType: string }>>().notNull().default([]),
  profitBoostPercent: numeric("profit_boost_percent").notNull().default("0"),
  potentialPayout: numeric("potential_payout").notNull(),
  actualPayout: numeric("actual_payout"),
  status: text("status").notNull().default("pending"), // pending, won, lost, push
  sport: text("sport"),
  playerName: text("player_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSimulatorBetSchema = createInsertSchema(simulatorBetsTable).omit({ id: true, createdAt: true });
export type InsertSimulatorBet = z.infer<typeof insertSimulatorBetSchema>;
export type SimulatorWallet = typeof simulatorWalletsTable.$inferSelect;
export type SimulatorBet = typeof simulatorBetsTable.$inferSelect;
