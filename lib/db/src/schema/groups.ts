import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

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
  groupId: integer("group_id").references(() => groupsTable.id).notNull(),
  userId: integer("user_id").references(() => usersTable.id).notNull(),
  role: text("role").default("member").notNull(), // 'admin' | 'member'
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

export const groupMessagesTable = pgTable("group_messages", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").references(() => groupsTable.id).notNull(),
  senderId: integer("sender_id").references(() => usersTable.id).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
