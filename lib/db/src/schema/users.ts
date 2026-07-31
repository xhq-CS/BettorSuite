import { pgTable, serial, text, timestamp, integer, boolean, numeric, uniqueIndex } from "drizzle-orm/pg-core";
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
  presenceStatus: text("presence_status").default("offline").notNull(),
  presenceUpdatedAt: timestamp("presence_updated_at"),
  trackerBankroll: numeric("tracker_bankroll").notNull().default("0"),
  trackerBreakEvenEnabled: boolean("tracker_break_even_enabled").default(false).notNull(),
  trackerBreakEvenBalance: numeric("tracker_break_even_balance"),
  trackerBreakEvenAdjustment: numeric("tracker_break_even_adjustment").notNull().default("0"),
  trackerBreakEvenSetAt: timestamp("tracker_break_even_set_at"),
  trackerWageredResetAt: timestamp("tracker_wagered_reset_at"),
  warRoomMuted: boolean("war_room_muted").default(false).notNull(),
  warRoomMutedAt: timestamp("war_room_muted_at"),
  warRoomMutedBy: integer("war_room_muted_by"),
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

export const userNicknamesTable = pgTable("user_nicknames", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id").references(() => usersTable.id, { onDelete: "cascade" }).notNull(),
  targetUserId: integer("target_user_id").references(() => usersTable.id, { onDelete: "cascade" }).notNull(),
  nickname: text("nickname").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("user_nicknames_owner_target_idx").on(table.ownerId, table.targetUserId)]);

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
export type Follow = typeof followsTable.$inferSelect;
export type UserNickname = typeof userNicknamesTable.$inferSelect;
