import { pgTable, serial, text, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userBlocksTable = pgTable("user_blocks", {
  id: serial("id").primaryKey(),
  blockerId: integer("blocker_id").references(() => usersTable.id, { onDelete: "cascade" }).notNull(),
  blockedId: integer("blocked_id").references(() => usersTable.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("user_blocks_pair_idx").on(table.blockerId, table.blockedId)]);

export const reportsTable = pgTable("reports", {
  id: serial("id").primaryKey(),
  reporterId: integer("reporter_id").references(() => usersTable.id, { onDelete: "set null" }),
  reporterEmail: text("reporter_email"),
  targetType: text("target_type").notNull(),
  targetId: text("target_id"),
  reportedUserId: integer("reported_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  category: text("category").notNull(),
  details: text("details").notNull(),
  status: text("status").default("open").notNull(),
  resolution: text("resolution"),
  reviewedBy: integer("reviewed_by").references(() => usersTable.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type UserBlock = typeof userBlocksTable.$inferSelect;
export type Report = typeof reportsTable.$inferSelect;
