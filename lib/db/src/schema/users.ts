import { pgTable, serial, text, timestamp, integer, boolean, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  // Nullable only for legacy seeded profiles; every newly registered account supplies both.
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  role: text("role").default("user").notNull(),
  displayName: text("display_name"),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  favoriteSport: text("favorite_sport"),
  trackerBankroll: numeric("tracker_bankroll").notNull().default("0"),
  trackerWageredResetAt: timestamp("tracker_wagered_reset_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sessionsTable = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }).notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  revoked: boolean("revoked").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const followsTable = pgTable("follows", {
  id: serial("id").primaryKey(),
  followerId: integer("follower_id").references(() => usersTable.id).notNull(),
  followingId: integer("following_id").references(() => usersTable.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
export type Follow = typeof followsTable.$inferSelect;
