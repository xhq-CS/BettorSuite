import { index, integer, numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const trackerWalletTransactionsTable = pgTable(
  "tracker_wallet_transactions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .references(() => usersTable.id, { onDelete: "cascade" })
      .notNull(),
    type: text("type").notNull(),
    amount: numeric("amount").notNull(),
    balanceAfter: numeric("balance_after").notNull(),
    reason: text("reason"),
    // Intentionally not a foreign key: removing an incorrect open bet must not erase its audit entry.
    betId: integer("bet_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("tracker_wallet_transactions_user_created_idx").on(table.userId, table.createdAt)],
);

export type TrackerWalletTransaction = typeof trackerWalletTransactionsTable.$inferSelect;
