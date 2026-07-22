import {
  boolean,
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import type { SharedBetSnapshot } from "./sharedBet";
import { dailyCardsTable } from "./social";

export const groupsTable = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  sport: text("sport"),
  avatarUrl: text("avatar_url"),
  creatorId: integer("creator_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const groupMembersTable = pgTable("group_members", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id")
    .references(() => groupsTable.id)
    .notNull(),
  userId: integer("user_id")
    .references(() => usersTable.id)
    .notNull(),
  role: text("role").default("member").notNull(), // 'admin' | 'member'
  muted: boolean("muted").default(false).notNull(),
  mutedAt: timestamp("muted_at"),
  mutedBy: integer("muted_by"),
  notificationsMuted: boolean("notifications_muted").default(false).notNull(),
  lastReadAt: timestamp("last_read_at"),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

export const groupMessagesTable = pgTable("group_messages", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id")
    .references(() => groupsTable.id)
    .notNull(),
  senderId: integer("sender_id")
    .references(() => usersTable.id)
    .notNull(),
  content: text("content").notNull(),
  betShare: jsonb("bet_share").$type<SharedBetSnapshot>(),
  dailyCardId: integer("daily_card_id").references(() => dailyCardsTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  editedAt: timestamp("edited_at"),
});

export const groupInvitesTable = pgTable("group_invites", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id")
    .references(() => groupsTable.id, { onDelete: "cascade" })
    .notNull(),
  userId: integer("user_id")
    .references(() => usersTable.id, { onDelete: "cascade" })
    .notNull(),
  invitedBy: integer("invited_by")
    .references(() => usersTable.id)
    .notNull(),
  status: text("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
