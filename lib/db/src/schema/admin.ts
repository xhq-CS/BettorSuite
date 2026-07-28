import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const adminAuditLogsTable = pgTable("admin_audit_logs", {
  id: serial("id").primaryKey(),
  actorId: integer("actor_id").references(() => usersTable.id, { onDelete: "set null" }),
  targetUserId: integer("target_user_id"),
  action: text("action").notNull(),
  reason: text("reason").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AdminAuditLog = typeof adminAuditLogsTable.$inferSelect;
