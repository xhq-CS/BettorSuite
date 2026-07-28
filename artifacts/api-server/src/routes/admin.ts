import { Router } from "express";
import { and, desc, eq, ilike, isNotNull, or, sql } from "drizzle-orm";
import {
  adminAuditLogsTable,
  betsTable,
  dailyCardsTable,
  db,
  groupMessagesTable,
  groupsTable,
  messagesTable,
  postLikesTable,
  postsTable,
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
  const [[user], bets, walletHistory, warRoomShares, groupShares, directShares, dailyCards] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.id, id)),
    db.select().from(betsTable).where(eq(betsTable.userId, id)).orderBy(desc(betsTable.betDate)),
    db.select().from(trackerWalletTransactionsTable).where(eq(trackerWalletTransactionsTable.userId, id)).orderBy(desc(trackerWalletTransactionsTable.createdAt)).limit(100),
    db
      .select({
        id: postsTable.id,
        content: postsTable.content,
        betShare: postsTable.betShare,
        dailyCardId: postsTable.dailyCardId,
        createdAt: postsTable.createdAt,
      })
      .from(postsTable)
      .where(and(
        eq(postsTable.userId, id),
        or(isNotNull(postsTable.betShare), isNotNull(postsTable.dailyCardId)),
      ))
      .orderBy(desc(postsTable.createdAt)),
    db
      .select({
        id: groupMessagesTable.id,
        groupId: groupMessagesTable.groupId,
        groupName: groupsTable.name,
        content: groupMessagesTable.content,
        betShare: groupMessagesTable.betShare,
        dailyCardId: groupMessagesTable.dailyCardId,
        createdAt: groupMessagesTable.createdAt,
      })
      .from(groupMessagesTable)
      .leftJoin(groupsTable, eq(groupMessagesTable.groupId, groupsTable.id))
      .where(and(
        eq(groupMessagesTable.senderId, id),
        or(isNotNull(groupMessagesTable.betShare), isNotNull(groupMessagesTable.dailyCardId)),
      ))
      .orderBy(desc(groupMessagesTable.createdAt)),
    db
      .select({
        id: messagesTable.id,
        conversationId: messagesTable.conversationId,
        content: messagesTable.content,
        betShare: messagesTable.betShare,
        dailyCardId: messagesTable.dailyCardId,
        createdAt: messagesTable.createdAt,
      })
      .from(messagesTable)
      .where(and(
        eq(messagesTable.senderId, id),
        or(isNotNull(messagesTable.betShare), isNotNull(messagesTable.dailyCardId)),
      ))
      .orderBy(desc(messagesTable.createdAt)),
    db
      .select({
        id: dailyCardsTable.id,
        title: dailyCardsTable.title,
        leagues: dailyCardsTable.leagues,
        picks: dailyCardsTable.picks,
        cardDate: dailyCardsTable.cardDate,
        createdAt: dailyCardsTable.createdAt,
      })
      .from(dailyCardsTable)
      .where(eq(dailyCardsTable.userId, id))
      .orderBy(desc(dailyCardsTable.createdAt)),
  ]);
  if (!user) return void res.status(404).json({ error: "User not found" });
  const sharedContent = [
    ...dailyCards.map((card) => ({
      id: card.id,
      source: "daily-card" as const,
      contentType: "daily-card" as const,
      title: card.title,
      destination: "Profile Daily Cards",
      detail: `${card.picks.length} picks · ${card.leagues.join(", ") || "Multiple leagues"}`,
      createdAt: card.createdAt,
    })),
    ...warRoomShares.map((post) => ({
      id: post.id,
      source: "war-room" as const,
      contentType: post.dailyCardId ? "daily-card-share" as const : "bet-slip" as const,
      title: post.dailyCardId ? "Shared Daily Card" : post.betShare?.description ?? "Shared Bet Slip",
      destination: "Public War Room",
      detail: post.content,
      createdAt: post.createdAt,
    })),
    ...groupShares.map((message) => ({
      id: message.id,
      source: "group" as const,
      contentType: message.dailyCardId ? "daily-card-share" as const : "bet-slip" as const,
      title: message.dailyCardId ? "Shared Daily Card" : message.betShare?.description ?? "Shared Bet Slip",
      destination: message.groupName ?? `Group #${message.groupId}`,
      detail: message.content,
      createdAt: message.createdAt,
    })),
    ...directShares.map((message) => ({
      id: message.id,
      source: "direct-message" as const,
      contentType: message.dailyCardId ? "daily-card-share" as const : "bet-slip" as const,
      title: message.dailyCardId ? "Shared Daily Card" : message.betShare?.description ?? "Shared Bet Slip",
      destination: `Direct Message #${message.conversationId}`,
      detail: message.content,
      createdAt: message.createdAt,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
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
    sharedContent,
  });
});

adminRouter.post("/users/:id/wallet/reconcile", async (req, res) => {
  const id = Number(req.params.id);
  const reason = requiredReason(req.body.reason);
  const balance = roundMoney(Number(req.body.balance));
  if (!Number.isFinite(balance) || balance < 0 || balance > 1_000_000_000) {
    return void res.status(400).json({ error: "Balance must be between $0 and $1,000,000,000" });
  }
  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!target) return void res.status(404).json({ error: "User not found" });
  if (target.role === "admin" && id !== actorId(req)) {
    return void res.status(403).json({ error: "Another administrator's wallet cannot be modified here" });
  }

  const requestedAdjustment = roundMoney(balance - Number(target.trackerBankroll));
  if (Math.abs(requestedAdjustment) < 0.001) {
    return void res.status(400).json({ error: "The Book Keeper wallet already matches that balance" });
  }

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${id})`);
    const [current] = await tx
      .select({ balance: usersTable.trackerBankroll })
      .from(usersTable)
      .where(eq(usersTable.id, id));
    if (!current) throw new Error("User not found");
    const currentBalance = roundMoney(Number(current.balance));
    const currentAdjustment = roundMoney(balance - currentBalance);
    if (Math.abs(currentAdjustment) < 0.001) {
      throw new Error("The Book Keeper wallet already matches that balance");
    }
    await tx
      .update(usersTable)
      .set({ trackerBankroll: String(balance) })
      .where(eq(usersTable.id, id));
    await tx.insert(trackerWalletTransactionsTable).values({
      userId: id,
      type: "admin_reconciliation",
      amount: String(currentAdjustment),
      balanceAfter: String(balance),
      reason,
    });
    return { previousBalance: currentBalance, adjustment: currentAdjustment };
  });
  await audit(actorId(req), id, "wallet.admin_reconciliation", reason, {
    from: result.previousBalance,
    to: balance,
    adjustment: result.adjustment,
  });
  return res.status(201).json({ balance, adjustment: result.adjustment });
});

adminRouter.delete("/users/:userId/shared-content/:source/:contentId", async (req, res) => {
  const userId = Number(req.params.userId);
  const contentId = Number(req.params.contentId);
  const source = String(req.params.source);
  const reason = requiredReason(req.body.reason);
  if (!["war-room", "group", "direct-message", "daily-card"].includes(source)) {
    return void res.status(400).json({ error: "Invalid shared-content source" });
  }
  const [target] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, userId));
  if (!target) return void res.status(404).json({ error: "User not found" });

  const deleted = await db.transaction(async (tx) => {
    if (source === "war-room") {
      const [post] = await tx
        .select({ id: postsTable.id, dailyCardId: postsTable.dailyCardId })
        .from(postsTable)
        .where(and(eq(postsTable.id, contentId), eq(postsTable.userId, userId)));
      if (!post) return null;
      await tx.delete(postLikesTable).where(eq(postLikesTable.postId, contentId));
      await tx.delete(postsTable).where(eq(postsTable.id, contentId));
      return { dailyCardId: post.dailyCardId };
    }
    if (source === "group") {
      const [message] = await tx
        .select({ id: groupMessagesTable.id, dailyCardId: groupMessagesTable.dailyCardId })
        .from(groupMessagesTable)
        .where(and(eq(groupMessagesTable.id, contentId), eq(groupMessagesTable.senderId, userId)));
      if (!message) return null;
      await tx.delete(groupMessagesTable).where(eq(groupMessagesTable.id, contentId));
      return { dailyCardId: message.dailyCardId };
    }
    if (source === "direct-message") {
      const [message] = await tx
        .select({ id: messagesTable.id, dailyCardId: messagesTable.dailyCardId })
        .from(messagesTable)
        .where(and(eq(messagesTable.id, contentId), eq(messagesTable.senderId, userId)));
      if (!message) return null;
      await tx.delete(messagesTable).where(eq(messagesTable.id, contentId));
      return { dailyCardId: message.dailyCardId };
    }

    const [card] = await tx
      .select({ id: dailyCardsTable.id })
      .from(dailyCardsTable)
      .where(and(eq(dailyCardsTable.id, contentId), eq(dailyCardsTable.userId, userId)));
    if (!card) return null;
    await tx.execute(sql`delete from post_likes where post_id in (select id from posts where daily_card_id = ${contentId})`);
    await tx.delete(postsTable).where(eq(postsTable.dailyCardId, contentId));
    await tx.delete(groupMessagesTable).where(eq(groupMessagesTable.dailyCardId, contentId));
    await tx.delete(messagesTable).where(eq(messagesTable.dailyCardId, contentId));
    await tx.delete(dailyCardsTable).where(eq(dailyCardsTable.id, contentId));
    return { dailyCardId: contentId };
  });

  if (!deleted) return void res.status(404).json({ error: "Shared content was not found for this account" });
  await audit(actorId(req), userId, "shared_content.deleted", reason, {
    source,
    contentId,
    dailyCardId: deleted.dailyCardId,
  });
  return res.status(204).send();
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
