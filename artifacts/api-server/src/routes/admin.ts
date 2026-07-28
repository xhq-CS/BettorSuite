import { Router } from "express";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import {
  adminAuditLogsTable,
  betsTable,
  db,
  trackerWalletTransactionsTable,
  usersTable,
} from "@workspace/db";
import type { AuthRequest } from "../middleware/auth";
import { purgeAccountData } from "../lib/accountPurge";
import { roundMoney } from "../lib/bettingMath";

export const adminRouter = Router();
const actorId = (req: unknown) => (req as AuthRequest).userId;

function requiredReason(value: unknown) {
  const reason = String(value ?? "").trim();
  if (reason.length < 3 || reason.length > 240) throw new Error("Add a 3-240 character moderation reason");
  return reason;
}

async function audit(actor: number, target: number, action: string, reason: string, metadata: Record<string, unknown> = {}) {
  await db.insert(adminAuditLogsTable).values({ actorId: actor, targetUserId: target, action, reason, metadata });
}

adminRouter.get("/overview", async (_req, res) => {
  const [[users], [bets], [open], recent] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(usersTable),
    db.select({ count: sql<number>`count(*)::int` }).from(betsTable),
    db.select({ count: sql<number>`count(*)::int` }).from(betsTable).where(eq(betsTable.status, "pending")),
    db.select().from(adminAuditLogsTable).orderBy(desc(adminAuditLogsTable.createdAt)).limit(20),
  ]);
  return res.json({ users: users.count, bets: bets.count, pendingBets: open.count, recent });
});

adminRouter.get("/users", async (req, res) => {
  const search = String(req.query.search ?? "").trim();
  const rows = await db.select({
    id: usersTable.id,
    username: usersTable.username,
    email: usersTable.email,
    displayName: usersTable.displayName,
    avatarUrl: usersTable.avatarUrl,
    role: usersTable.role,
    trackerBankroll: usersTable.trackerBankroll,
    warRoomMuted: usersTable.warRoomMuted,
    createdAt: usersTable.createdAt,
  }).from(usersTable).where(search ? or(
    ilike(usersTable.username, `%${search}%`),
    ilike(usersTable.email, `%${search}%`),
    ilike(usersTable.displayName, `%${search}%`),
  ) : undefined).orderBy(desc(usersTable.createdAt)).limit(200);
  return res.json(rows.map((user) => ({ ...user, trackerBankroll: Number(user.trackerBankroll) })));
});

adminRouter.get("/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [[user], bets, walletHistory] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.id, id)),
    db.select().from(betsTable).where(eq(betsTable.userId, id)).orderBy(desc(betsTable.betDate)),
    db.select().from(trackerWalletTransactionsTable).where(eq(trackerWalletTransactionsTable.userId, id)).orderBy(desc(trackerWalletTransactionsTable.createdAt)).limit(100),
  ]);
  if (!user) return void res.status(404).json({ error: "User not found" });
  return res.json({
    user: { ...user, passwordHash: undefined, trackerBankroll: Number(user.trackerBankroll) },
    bets: bets.map((bet) => ({
      ...bet,
      wager: Number(bet.wager),
      odds: Number(bet.odds),
      potentialPayout: Number(bet.potentialPayout),
      actualPayout: bet.actualPayout === null ? null : Number(bet.actualPayout),
    })),
    walletHistory: walletHistory.map((item) => ({ ...item, amount: Number(item.amount), balanceAfter: Number(item.balanceAfter) })),
  });
});

adminRouter.patch("/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  const reason = requiredReason(req.body.reason);
  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!target) return void res.status(404).json({ error: "User not found" });
  if (target.role === "admin" && id !== actorId(req)) return void res.status(403).json({ error: "Another administrator cannot be modified here" });
  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (req.body.username !== undefined) updates.username = String(req.body.username).trim().toLowerCase();
  if (req.body.email !== undefined) updates.email = String(req.body.email).trim().toLowerCase();
  if (req.body.displayName !== undefined) updates.displayName = String(req.body.displayName).trim() || null;
  if (req.body.bio !== undefined) updates.bio = String(req.body.bio).trim() || null;
  if (req.body.favoriteSport !== undefined) updates.favoriteSport = String(req.body.favoriteSport).trim() || null;
  if (req.body.warRoomMuted !== undefined) {
    updates.warRoomMuted = Boolean(req.body.warRoomMuted);
    updates.warRoomMutedAt = updates.warRoomMuted ? new Date() : null;
    updates.warRoomMutedBy = updates.warRoomMuted ? actorId(req) : null;
  }
  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
  await audit(actorId(req), id, "user.updated", reason, { fields: Object.keys(updates) });
  return res.json({ ...updated, passwordHash: undefined });
});

function walletContribution(bet: typeof betsTable.$inferSelect) {
  const wager = Number(bet.wager);
  if (bet.status === "pending") return -wager;
  if (bet.status === "won") return Number(bet.actualPayout ?? bet.potentialPayout) - wager;
  if (bet.status === "lost") return -wager;
  return 0;
}

adminRouter.patch("/users/:userId/bets/:betId", async (req, res) => {
  const userId = Number(req.params.userId);
  const betId = Number(req.params.betId);
  const status = String(req.body.status);
  if (!["pending", "won", "lost", "push", "void"].includes(status)) return void res.status(400).json({ error: "Invalid result" });
  const reason = requiredReason(req.body.reason);
  const [bet] = await db.select().from(betsTable).where(and(eq(betsTable.id, betId), eq(betsTable.userId, userId)));
  if (!bet) return void res.status(404).json({ error: "Bet not found" });
  const nextActual = status === "won" ? Number(bet.potentialPayout) : status === "push" ? Number(bet.wager) : status === "pending" ? null : 0;
  const nextContribution = status === "pending" ? -Number(bet.wager) : status === "won" ? nextActual! - Number(bet.wager) : status === "lost" ? -Number(bet.wager) : 0;
  const walletChange = roundMoney(nextContribution - walletContribution(bet));
  const [updated] = await db.transaction(async (tx) => {
    const [wallet] = await tx.update(usersTable).set({ trackerBankroll: sql`${usersTable.trackerBankroll} + ${walletChange}` }).where(eq(usersTable.id, userId)).returning({ balance: usersTable.trackerBankroll });
    if (!wallet || Number(wallet.balance) < 0) throw new Error("Correction would make the wallet negative");
    await tx.insert(trackerWalletTransactionsTable).values({ userId, type: "admin_bet_correction", amount: String(walletChange), balanceAfter: wallet.balance, reason, betId });
    return tx.update(betsTable).set({ status, actualPayout: nextActual === null ? null : String(nextActual), settledAt: status === "pending" ? null : new Date(), updatedAt: new Date() }).where(eq(betsTable.id, betId)).returning();
  });
  await audit(actorId(req), userId, "bet.corrected", reason, { betId, from: bet.status, to: status, walletChange });
  return res.json(updated);
});

adminRouter.delete("/users/:userId/bets/:betId", async (req, res) => {
  const userId = Number(req.params.userId);
  const betId = Number(req.params.betId);
  const reason = requiredReason(req.body.reason);
  const [bet] = await db.select().from(betsTable).where(and(eq(betsTable.id, betId), eq(betsTable.userId, userId)));
  if (!bet) return void res.status(204).send();
  const walletChange = roundMoney(-walletContribution(bet));
  await db.transaction(async (tx) => {
    const [wallet] = await tx.update(usersTable).set({ trackerBankroll: sql`${usersTable.trackerBankroll} + ${walletChange}` }).where(eq(usersTable.id, userId)).returning({ balance: usersTable.trackerBankroll });
    await tx.insert(trackerWalletTransactionsTable).values({ userId, type: "admin_bet_reversal", amount: String(walletChange), balanceAfter: wallet.balance, reason, betId });
    await tx.delete(betsTable).where(eq(betsTable.id, betId));
  });
  await audit(actorId(req), userId, "bet.deleted_reversed", reason, { betId, walletChange });
  return res.status(204).send();
});

adminRouter.post("/users/:id/reset", async (req, res) => {
  const id = Number(req.params.id);
  const reason = requiredReason(req.body.reason);
  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!target) return void res.status(404).json({ error: "User not found" });
  if (target.role === "admin") return void res.status(403).json({ error: "Administrator accounts cannot be reset" });
  if (String(req.body.confirmation) !== target.username) return void res.status(400).json({ error: "Type the username to confirm the reset" });
  await purgeAccountData(id, false);
  await audit(actorId(req), id, "account.data_reset", reason);
  return res.status(204).send();
});

adminRouter.delete("/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  const reason = requiredReason(req.body.reason);
  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!target) return void res.status(204).send();
  if (target.role === "admin" || id === actorId(req)) return void res.status(403).json({ error: "Administrator accounts cannot be deleted here" });
  if (String(req.body.confirmation) !== target.username) return void res.status(400).json({ error: "Type the username to confirm account deletion" });
  await purgeAccountData(id, true);
  await audit(actorId(req), id, "account.deleted", reason, { username: target.username });
  return res.status(204).send();
});

adminRouter.get("/audit", async (_req, res) => {
  return res.json(await db.select().from(adminAuditLogsTable).orderBy(desc(adminAuditLogsTable.createdAt)).limit(200));
});
