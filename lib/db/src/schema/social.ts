import {
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import type { SharedBetSnapshot } from "./sharedBet";

export const dailyCardsTable = pgTable("daily_cards", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => usersTable.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull(),
  note: text("note"),
  leagues: jsonb("leagues").$type<string[]>().notNull().default([]),
  picks: jsonb("picks")
    .$type<SharedBetSnapshot[]>()
    .notNull()
    .default([]),
  cardDate: timestamp("card_date").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const publicBetRevisionsTable = pgTable("public_bet_revisions", {
  id: serial("id").primaryKey(),
  sourceBetId: integer("source_bet_id").notNull(),
  userId: integer("user_id")
    .references(() => usersTable.id, { onDelete: "cascade" })
    .notNull(),
  action: text("action").notNull(), // placed | edited
  snapshot: jsonb("snapshot").$type<SharedBetSnapshot>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type DailyCard = typeof dailyCardsTable.$inferSelect;
export type PublicBetRevision = typeof publicBetRevisionsTable.$inferSelect;
