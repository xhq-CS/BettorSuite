import { Router } from "express";
import { db } from "@workspace/db";
import {
  betsTable,
  publicBetRevisionsTable,
  trackerWalletTransactionsTable,
  usersTable,
} from "@workspace/db";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import {
  CreateBetBody,
  UpdateBetParams,
  DeleteBetParams,
  ListBetsQueryParams,
} from "@workspace/api-zod";
import type { AuthRequest } from "../middleware/auth";
import { trackerBetSnapshot } from "../lib/betSnapshots";
import { boostedAmericanOdds, calculateTotalPayout, roundMoney } from "../lib/bettingMath";
import { parseOptionalBetDate, rangeStart } from "../lib/localDates";

export const betsRouter = Router();
const MONTHLY_RECONCILIATION_LIMIT = 3;

type ParlayLeg = { description: string; odds: number; sport: string; betType: string };

function normalizeParlayLegs(value: unknown): ParlayLeg[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error("Parlay legs must be a list");
  if (value.length === 0) return [];
  if (value.length < 2 || value.length > 20) throw new Error("A parlay requires 2 to 20 legs");
  return value.map((raw, index) => {
    const leg = raw as Partial<ParlayLeg>;
    const description = String(leg.description ?? "").trim();
    const odds = Number(leg.odds);
    const sport = String(leg.sport ?? "").trim();
    const betType = String(leg.betType ?? "").trim();
    if (!description || description.length > 160 || !Number.isFinite(odds) || odds === 0 || !sport || !betType) {
      throw new Error(`Leg ${index + 1} needs a description, sport, type, and valid odds`);
    }
    return { description, odds, sport, betType };
  });
}

function calcParlayOdds(legs: ParlayLeg[]): number {
  const decimal = legs.reduce((combined, leg) => combined * (leg.odds > 0 ? 1 + leg.odds / 100 : 1 + 100 / Math.abs(leg.odds)), 1);
  return Math.round(decimal >= 2 ? (decimal - 1) * 100 : -100 / (decimal - 1));
}

function trackerBalanceDelta(
  status: string,
  wager: number,
  potentialPayout: number,
  actualPayout: number | null | undefined,
  walletReserved: boolean,
) {
  if (!walletReserved) {
    if (status === "won") return Number(actualPayout ?? potentialPayout) - wager;
    if (status === "lost") return -wager;
    return 0;
  }
  if (status === "won") return Number(actualPayout ?? potentialPayout) - wager;
  if (status === "push" || status === "void") return 0;
  return -wager;
}

class InsufficientTrackerBalanceError extends Error {}

class WalletRuleError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

function monthWindow(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const resetsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, resetsAt };
}

async function trackerWalletOverview(userId: number) {
  const { start, resetsAt } = monthWindow();
  const [[user], transactions, [{ betCount }], [{ reconciliationsUsed }]] = await Promise.all([
    db
      .select({
        balance: usersTable.trackerBankroll,
        breakEvenEnabled: usersTable.trackerBreakEvenEnabled,
        breakEvenBalance: usersTable.trackerBreakEvenBalance,
        breakEvenAdjustment: usersTable.trackerBreakEvenAdjustment,
        breakEvenSetAt: usersTable.trackerBreakEvenSetAt,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId)),
    db
      .select()
      .from(trackerWalletTransactionsTable)
      .where(eq(trackerWalletTransactionsTable.userId, userId))
      .orderBy(desc(trackerWalletTransactionsTable.createdAt))
      .limit(20),
    db
      .select({ betCount: sql<number>`count(*)::int` })
      .from(betsTable)
      .where(eq(betsTable.userId, userId)),
    db
      .select({ reconciliationsUsed: sql<number>`count(*)::int` })
      .from(trackerWalletTransactionsTable)
      .where(
        and(
          eq(trackerWalletTransactionsTable.userId, userId),
          eq(trackerWalletTransactionsTable.type, "reconciliation"),
          gte(trackerWalletTransactionsTable.createdAt, start),
        ),
      ),
  ]);

  if (!user) return null;
  const balance = roundMoney(Number(user.balance));
  const initialized = transactions.length > 0 || betCount > 0 || balance !== 0;
  return {
    balance,
    initialized,
    breakEvenEnabled: user.breakEvenEnabled,
    breakEvenBalance: user.breakEvenBalance === null ? null : Number(user.breakEvenBalance),
    breakEvenAdjustment: Number(user.breakEvenAdjustment),
    breakEvenSetAt: user.breakEvenSetAt?.toISOString() ?? null,
    reconciliationsUsed,
    reconciliationLimit: MONTHLY_RECONCILIATION_LIMIT,
    reconciliationResetsAt: resetsAt.toISOString(),
    transactions: transactions.map((transaction) => ({
      id: transaction.id,
      type: transaction.type,
      amount: roundMoney(Number(transaction.amount)),
      balanceAfter: roundMoney(Number(transaction.balanceAfter)),
      reason: transaction.reason ?? null,
      betId: transaction.betId ?? null,
      createdAt: transaction.createdAt.toISOString(),
    })),
  };
}

async function applyWalletTransaction(
  userId: number,
  input: {
    type: "deposit" | "withdrawal" | "reconciliation";
    amount?: number;
    balance?: number;
    reason?: string;
  },
) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${userId})`);
    const [[user], [{ betCount }], [{ transactionCount }]] = await Promise.all([
      tx.select({ balance: usersTable.trackerBankroll }).from(usersTable).where(eq(usersTable.id, userId)),
      tx.select({ betCount: sql<number>`count(*)::int` }).from(betsTable).where(eq(betsTable.userId, userId)),
      tx
        .select({ transactionCount: sql<number>`count(*)::int` })
        .from(trackerWalletTransactionsTable)
        .where(eq(trackerWalletTransactionsTable.userId, userId)),
    ]);
    if (!user) throw new WalletRuleError("User not found", 404);

    const currentBalance = roundMoney(Number(user.balance));
    const initialized = transactionCount > 0 || betCount > 0 || currentBalance !== 0;
    const reason = input.reason?.trim() ?? "";
    let transactionType: string = input.type;
    let walletChange = 0;
    let balanceAfter = currentBalance;
    let transactionReason = reason;

    if (input.type === "deposit") {
      walletChange = roundMoney(Number(input.amount));
      balanceAfter = roundMoney(currentBalance + walletChange);
      transactionReason ||= "Sportsbook deposit";
    } else if (input.type === "withdrawal") {
      walletChange = -roundMoney(Number(input.amount));
      if (Math.abs(walletChange) > currentBalance) {
        throw new WalletRuleError("Withdrawal cannot exceed the current wallet balance");
      }
      balanceAfter = roundMoney(currentBalance + walletChange);
      transactionReason ||= "Sportsbook withdrawal";
    } else {
      if (initialized && reason.length < 3) {
        throw new WalletRuleError("Add a brief reason for this balance reconciliation");
      }
      if (initialized) {
        const { start } = monthWindow();
        const [{ used }] = await tx
          .select({ used: sql<number>`count(*)::int` })
          .from(trackerWalletTransactionsTable)
          .where(
            and(
              eq(trackerWalletTransactionsTable.userId, userId),
              eq(trackerWalletTransactionsTable.type, "reconciliation"),
              gte(trackerWalletTransactionsTable.createdAt, start),
            ),
          );
        if (used >= MONTHLY_RECONCILIATION_LIMIT) {
          throw new WalletRuleError("You have used all 3 wallet reconciliations for this month", 429);
        }
      } else {
        transactionType = "setup";
        transactionReason ||= "Initial sportsbook balance";
      }
      balanceAfter = roundMoney(Number(input.balance));
      walletChange = roundMoney(balanceAfter - currentBalance);
      if (initialized && Math.abs(walletChange) < 0.001) {
        throw new WalletRuleError("Your wallet already matches that balance");
      }
    }

    await tx.update(usersTable).set({ trackerBankroll: String(balanceAfter) }).where(eq(usersTable.id, userId));
    await tx.insert(trackerWalletTransactionsTable).values({
      userId,
      type: transactionType,
      amount: String(walletChange),
      balanceAfter: String(balanceAfter),
      reason: transactionReason || null,
    });
  });
}

function formatBet(b: typeof betsTable.$inferSelect) {
  return {
    id: b.id,
    userId: b.userId,
    description: b.description,
    betType: b.betType,
    sportsbook: b.sportsbook ?? null,
    wager: Number(b.wager),
    odds: Number(b.odds),
    parlayLegs: b.parlayLegs,
    profitBoostPercent: Number(b.profitBoostPercent),
    boostedOdds: boostedAmericanOdds(Number(b.odds), Number(b.profitBoostPercent)),
    payoutOverride: b.payoutOverride !== null ? Number(b.payoutOverride) : null,
    potentialPayout: Number(b.potentialPayout),
    actualPayout: b.actualPayout !== null ? Number(b.actualPayout) : null,
    status: b.status,
    sport: b.sport ?? null,
    playerName: b.playerName ?? null,
    notes: b.notes ?? null,
    createdAt: b.createdAt.toISOString(),
    betDate: b.betDate.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
    settledAt: b.settledAt ? b.settledAt.toISOString() : null,
  };
}

// GET /bets
betsRouter.get("/", async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId;
  const query = ListBetsQueryParams.parse(req.query);
  const conditions = [eq(betsTable.userId, userId)];
  if (query.status) conditions.push(eq(betsTable.status, query.status));

  const rows = await db
    .select()
    .from(betsTable)
    .where(and(...conditions))
    .orderBy(desc(betsTable.createdAt));

  res.json(rows.map(formatBet));
});

// GET /bets/summary
betsRouter.get("/summary", async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId;
  const range = ["today", "week", "month", "all"].includes(String(req.query.range))
    ? String(req.query.range)
    : "all";
  const includeBaseline = req.query.includeBaseline === "true" && range === "all";
  const [rows, [user]] = await Promise.all([
    db.select().from(betsTable).where(eq(betsTable.userId, userId)),
    db.select({
      wageredResetAt: usersTable.trackerWageredResetAt,
      breakEvenEnabled: usersTable.trackerBreakEvenEnabled,
      breakEvenAdjustment: usersTable.trackerBreakEvenAdjustment,
    }).from(usersTable).where(eq(usersTable.id, userId)),
  ]);

  const start = rangeStart(range);
  const filteredRows = start ? rows.filter((bet) => bet.betDate >= start) : rows;
  const settled = filteredRows.filter((b) => ["won", "lost", "push"].includes(b.status));
  const wins = settled.filter((b) => b.status === "won").length;
  const losses = settled.filter((b) => b.status === "lost").length;
  const pushes = settled.filter((b) => b.status === "push").length;
  const wageredRows = user?.wageredResetAt
    ? filteredRows.filter(bet => bet.betDate > user.wageredResetAt!)
    : filteredRows;
  const totalWagered = wageredRows.reduce((sum, b) => sum + Number(b.wager), 0);
  const settledWagered = settled.reduce((sum, b) => sum + Number(b.wager), 0);
  const trackedProfit = settled.reduce((sum, b) => {
    if (b.status === "won") return sum + Number(b.actualPayout ?? b.potentialPayout) - Number(b.wager);
    if (b.status === "lost") return sum - Number(b.wager);
    return sum;
  }, 0);
  const baselineAdjustment =
    includeBaseline && user?.breakEvenEnabled ? Number(user.breakEvenAdjustment) : 0;
  const totalProfit = trackedProfit + baselineAdjustment;
  const decidedBets = wins + losses;
  const winRate = decidedBets > 0 ? wins / decidedBets : 0;
  const roi = settledWagered > 0 ? totalProfit / settledWagered : 0;

  res.json({
    totalBets: filteredRows.length,
    wins,
    losses,
    pushes,
    winRate,
    totalWagered,
    totalProfit,
    trackedProfit,
    baselineAdjustment,
    range,
    roi,
  });
});

betsRouter.put("/wallet/break-even", async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId;
  const enabled = Boolean(req.body.enabled);
  const referenceBalance = Number(req.body.referenceBalance);
  const [user] = await db.select({ balance: usersTable.trackerBankroll }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user) return void res.status(404).json({ error: "User not found" });
  if (enabled && (!Number.isFinite(referenceBalance) || referenceBalance < 0 || referenceBalance > 1_000_000_000)) {
    return void res.status(400).json({ error: "Original sportsbook balance must be zero or greater" });
  }
  const adjustment = enabled ? roundMoney(Number(user.balance) - referenceBalance) : 0;
  await db.update(usersTable).set({
    trackerBreakEvenEnabled: enabled,
    trackerBreakEvenBalance: enabled ? String(referenceBalance) : null,
    trackerBreakEvenAdjustment: String(adjustment),
    trackerBreakEvenSetAt: enabled ? new Date() : null,
  }).where(eq(usersTable.id, userId));
  return res.json(await trackerWalletOverview(userId));
});

// POST /bets/summary/reset-total-wagered — restart this account's wager counter without deleting history
betsRouter.post("/summary/reset-total-wagered", async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId;
  const [user] = await db
    .update(usersTable)
    .set({ trackerWageredResetAt: new Date() })
    .where(eq(usersTable.id, userId))
    .returning({ wageredResetAt: usersTable.trackerWageredResetAt });

  if (!user) return void res.status(404).json({ error: "User not found" });
  return res.json({ totalWagered: 0, wageredResetAt: user.wageredResetAt?.toISOString() ?? null });
});

// GET /bets/wallet — account-scoped sportsbook bankroll reference
betsRouter.get("/wallet", async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId;
  const wallet = await trackerWalletOverview(userId);
  if (!wallet) return void res.status(404).json({ error: "User not found" });
  return res.json(wallet);
});

// PATCH /bets/wallet — manually match the user's sportsbook balance
betsRouter.patch("/wallet", async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId;
  const reason = String(req.body.reason ?? "").trim();
  const requestedBalance = Number(req.body.balance);
  if (!Number.isFinite(requestedBalance) || requestedBalance < 0 || requestedBalance > 1_000_000_000) {
    return void res.status(400).json({ error: "Balance must be zero or greater" });
  }
  if (reason.length < 3 || reason.length > 160) {
    return void res.status(400).json({ error: "Add a brief reason for this balance reconciliation" });
  }

  try {
    await applyWalletTransaction(userId, {
      type: "reconciliation",
      balance: requestedBalance,
      reason,
    });
  } catch (error) {
    if (error instanceof WalletRuleError) {
      return void res.status(error.status).json({ error: error.message });
    }
    throw error;
  }

  return res.json(await trackerWalletOverview(userId));
});

// POST /bets/wallet/transactions - auditable deposits, withdrawals, and limited reconciliations
betsRouter.post("/wallet/transactions", async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId;
  const type = String(req.body.type ?? "").trim().toLowerCase();
  const reason = String(req.body.reason ?? "").trim();
  if (!(["deposit", "withdrawal", "reconciliation"] as const).includes(type as never)) {
    return void res.status(400).json({ error: "Choose deposit, withdrawal, or reconciliation" });
  }
  if (reason.length > 160) return void res.status(400).json({ error: "Reason cannot exceed 160 characters" });

  const amount = Number(req.body.amount);
  const balance = Number(req.body.balance);
  if (type !== "reconciliation" && (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000)) {
    return void res.status(400).json({ error: "Amount must be greater than zero" });
  }
  if (type === "reconciliation" && (!Number.isFinite(balance) || balance < 0 || balance > 1_000_000_000)) {
    return void res.status(400).json({ error: "Balance must be zero or greater" });
  }

  try {
    await applyWalletTransaction(userId, {
      type: type as "deposit" | "withdrawal" | "reconciliation",
      amount,
      balance,
      reason,
    });
  } catch (error) {
    if (error instanceof WalletRuleError) {
      return void res.status(error.status).json({ error: error.message });
    }
    throw error;
  }
  return res.status(201).json(await trackerWalletOverview(userId));
});

// POST /bets
betsRouter.post("/", async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId;
  const body = CreateBetBody.parse(req.body);
  const wager = body.wager;
  let parlayLegs: ParlayLeg[];
  try { parlayLegs = normalizeParlayLegs(body.parlayLegs); }
  catch (error) { return void res.status(400).json({ error: error instanceof Error ? error.message : "Invalid parlay" }); }
  const isParlay = body.betType === "parlay" || parlayLegs.length > 0;
  if (isParlay && parlayLegs.length < 2) return void res.status(400).json({ error: "A parlay requires at least two legs" });
  const odds = body.odds;
  const profitBoostPercent = Math.round(body.profitBoostPercent ?? 0);
  const payoutOverride = req.body.payoutOverride === undefined || req.body.payoutOverride === ""
    ? null : Number(req.body.payoutOverride);
  let betDate: Date;
  try { betDate = parseOptionalBetDate(req.body.betDate); }
  catch (error) { return void res.status(400).json({ error: (error as Error).message }); }
  if (!body.description.trim() || !Number.isFinite(wager) || wager <= 0 || !Number.isFinite(odds) || odds === 0 || !Number.isFinite(profitBoostPercent) || profitBoostPercent < 0 || profitBoostPercent > 1000) {
    return void res.status(400).json({ error: "Valid description, wager, and odds are required" });
  }
  if (payoutOverride !== null && (!Number.isFinite(payoutOverride) || payoutOverride < wager)) {
    return void res.status(400).json({ error: "Total payout must be at least the wager" });
  }
  const potentialPayout = calculateTotalPayout(wager, odds, profitBoostPercent, payoutOverride);
  try {
    const bet = await db.transaction(async (tx) => {
      const [wallet] = await tx
        .update(usersTable)
        .set({
          trackerBankroll: sql`${usersTable.trackerBankroll} - ${wager}`,
        })
        .where(
          and(
            eq(usersTable.id, userId),
            gte(usersTable.trackerBankroll, String(wager)),
          ),
        )
        .returning({ balance: usersTable.trackerBankroll });
      if (!wallet) throw new InsufficientTrackerBalanceError();

      const [created] = await tx
        .insert(betsTable)
        .values({
          userId,
          description: isParlay ? (body.description.trim() || `${parlayLegs.length}-Leg Parlay`) : body.description.trim(),
          betType: isParlay ? "parlay" : body.betType,
          sportsbook: body.sportsbook ?? null,
          wager: String(wager),
          odds: String(odds),
          parlayLegs,
          profitBoostPercent: String(profitBoostPercent),
          payoutOverride: payoutOverride === null ? null : String(payoutOverride),
          potentialPayout: String(potentialPayout),
          betDate,
          status: "pending",
          walletReserved: true,
          sport: isParlay ? "Multiple" : (body.sport ?? null),
          playerName: body.playerName ?? null,
          notes: body.notes ?? null,
        })
        .returning();
      await tx.insert(trackerWalletTransactionsTable).values({
        userId,
        type: "wager",
        amount: String(roundMoney(-wager)),
        balanceAfter: String(roundMoney(Number(wallet.balance))),
        reason: created.description,
        betId: created.id,
      });
      await tx.insert(publicBetRevisionsTable).values({
        sourceBetId: created.id,
        userId,
        action: "placed",
        snapshot: trackerBetSnapshot(created),
      });
      return created;
    });
    return res.status(201).json(formatBet(bet));
  } catch (error) {
    if (error instanceof InsufficientTrackerBalanceError) {
      return void res.status(400).json({ error: "Wager exceeds your tracker wallet balance" });
    }
    throw error;
  }
});

// PATCH /bets/:id
betsRouter.patch("/:id", async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId;
  const { id } = UpdateBetParams.parse({ id: Number(req.params.id) });
  const [existing] = await db.select().from(betsTable).where(and(eq(betsTable.id, id), eq(betsTable.userId, userId)));
  if (!existing) return void res.status(404).json({ error: "Bet not found" });

  const description = req.body.description === undefined ? existing.description : String(req.body.description).trim();
  const sportsbook = req.body.sportsbook === undefined ? existing.sportsbook : String(req.body.sportsbook).trim();
  const sport = req.body.sport === undefined ? existing.sport : String(req.body.sport).trim();
  const notes = req.body.notes === undefined ? existing.notes : String(req.body.notes);
  const wager = Number(existing.wager);
  const odds = Number(existing.odds);
  const profitBoostPercent = Number(existing.profitBoostPercent);
  const parlayLegs = existing.parlayLegs;
  const lockedFieldChanged =
    (req.body.betType !== undefined && String(req.body.betType).trim() !== existing.betType) ||
    (req.body.wager !== undefined && roundMoney(Number(req.body.wager)) !== roundMoney(wager)) ||
    (req.body.odds !== undefined && Number(req.body.odds) !== odds) ||
    (req.body.profitBoostPercent !== undefined && Number(req.body.profitBoostPercent) !== profitBoostPercent) ||
    (req.body.parlayLegs !== undefined && JSON.stringify(req.body.parlayLegs) !== JSON.stringify(parlayLegs));
  if (lockedFieldChanged) {
    return void res.status(409).json({
      error: "Wager, odds, bet type, parlay legs, and profit boost are locked after placement",
    });
  }
  const status = req.body.status === undefined ? existing.status : String(req.body.status);
  const correctionReason = String(req.body.correctionReason ?? "").trim();
  const isExistingSettled = existing.status !== "pending";
  const isStatusCorrection = isExistingSettled && status !== existing.status;
  if (status === "pending" && isExistingSettled) {
    return void res.status(409).json({ error: "A settled Book Keeper bet cannot be reopened" });
  }
  if (isStatusCorrection && (correctionReason.length < 3 || correctionReason.length > 160)) {
    return void res.status(400).json({ error: "Add a brief reason to correct a settled result" });
  }
  if (!description || !["pending", "won", "lost", "push", "void"].includes(status)) {
    return void res.status(400).json({ error: "Valid description and status are required" });
  }
  const potentialPayout = calculateTotalPayout(wager, odds, profitBoostPercent, existing.payoutOverride === null ? null : Number(existing.payoutOverride));
  const actualPayout = status === "won" ? potentialPayout : status === "push" ? wager : status === "pending" ? null : 0;
  const previousBalanceDelta = trackerBalanceDelta(existing.status, Number(existing.wager), Number(existing.potentialPayout), existing.actualPayout === null ? null : Number(existing.actualPayout), existing.walletReserved);
  const nextBalanceDelta = trackerBalanceDelta(status, wager, potentialPayout, actualPayout, existing.walletReserved);
  const walletChange = roundMoney(nextBalanceDelta - previousBalanceDelta);

  const updates: Partial<typeof betsTable.$inferInsert> = {
    description, sportsbook: sportsbook || null, sport: existing.betType === "parlay" ? "Multiple" : (sport || null), notes,
    status, actualPayout: actualPayout === null ? null : String(actualPayout),
    updatedAt: new Date(),
    settledAt: status === "pending" ? null : (existing.settledAt ?? new Date()),
  };

  try {
    const bet = await db.transaction(async (tx) => {
      let balanceAfter: number | null = null;
      if (walletChange < -0.000001) {
        const required = Math.abs(walletChange);
        const [wallet] = await tx
          .update(usersTable)
          .set({ trackerBankroll: sql`${usersTable.trackerBankroll} - ${required}` })
          .where(and(eq(usersTable.id, userId), gte(usersTable.trackerBankroll, String(required))))
          .returning({ balance: usersTable.trackerBankroll });
        if (!wallet) throw new InsufficientTrackerBalanceError();
        balanceAfter = roundMoney(Number(wallet.balance));
      } else if (walletChange > 0.000001) {
        const [wallet] = await tx
          .update(usersTable)
          .set({ trackerBankroll: sql`${usersTable.trackerBankroll} + ${walletChange}` })
          .where(eq(usersTable.id, userId))
          .returning({ balance: usersTable.trackerBankroll });
        balanceAfter = roundMoney(Number(wallet.balance));
      }
      if (balanceAfter !== null) {
        const transactionType = isStatusCorrection
          ? "bet_correction"
          : status === "won"
            ? "payout"
            : "refund";
        await tx.insert(trackerWalletTransactionsTable).values({
          userId,
          type: transactionType,
          amount: String(walletChange),
          balanceAfter: String(balanceAfter),
          reason: isStatusCorrection ? correctionReason : `${existing.description} marked ${status}`,
          betId: existing.id,
        });
      }
      await tx.insert(publicBetRevisionsTable).values({
        sourceBetId: existing.id,
        userId,
        action: "edited",
        snapshot: trackerBetSnapshot(existing),
      });
      const [updated] = await tx
        .update(betsTable)
        .set(updates)
        .where(and(eq(betsTable.id, id), eq(betsTable.userId, userId)))
        .returning();
      return updated;
    });
    return res.json(formatBet(bet));
  } catch (error) {
    if (error instanceof InsufficientTrackerBalanceError) {
      return void res.status(400).json({ error: "This change exceeds your tracker wallet balance" });
    }
    throw error;
  }
});

// DELETE /bets/:id
betsRouter.delete("/:id", async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId;
  const { id } = DeleteBetParams.parse({ id: Number(req.params.id) });
  const [existing] = await db.select().from(betsTable).where(and(eq(betsTable.id, id), eq(betsTable.userId, userId)));
  if (!existing) return void res.status(204).send();
  if (existing.status !== "pending") {
    return void res.status(409).json({ error: "Settled Book Keeper bets cannot be removed. Use Correct Result instead" });
  }
  const reason = String(req.body.reason ?? "").trim();
  if (reason.length < 3 || reason.length > 160) {
    return void res.status(400).json({ error: "Add a brief reason for removing this open bet" });
  }
  const previousBalanceDelta = trackerBalanceDelta(existing.status, Number(existing.wager), Number(existing.potentialPayout), existing.actualPayout === null ? null : Number(existing.actualPayout), existing.walletReserved);
  const walletChange = roundMoney(-previousBalanceDelta);
  try {
    await db.transaction(async (tx) => {
      if (walletChange < -0.000001) {
        const required = Math.abs(walletChange);
        const [wallet] = await tx
          .update(usersTable)
          .set({ trackerBankroll: sql`${usersTable.trackerBankroll} - ${required}` })
          .where(and(eq(usersTable.id, userId), gte(usersTable.trackerBankroll, String(required))))
          .returning({ balance: usersTable.trackerBankroll });
        if (!wallet) throw new InsufficientTrackerBalanceError();
      } else if (walletChange > 0.000001) {
        const [wallet] = await tx
          .update(usersTable)
          .set({ trackerBankroll: sql`${usersTable.trackerBankroll} + ${walletChange}` })
          .where(eq(usersTable.id, userId))
          .returning({ balance: usersTable.trackerBankroll });
        await tx.insert(trackerWalletTransactionsTable).values({
          userId,
          type: "bet_removal",
          amount: String(walletChange),
          balanceAfter: String(roundMoney(Number(wallet.balance))),
          reason,
          betId: existing.id,
        });
      }
      await tx
        .delete(publicBetRevisionsTable)
        .where(
          and(
            eq(publicBetRevisionsTable.sourceBetId, existing.id),
            eq(publicBetRevisionsTable.userId, userId),
          ),
        );
      await tx
        .delete(betsTable)
        .where(and(eq(betsTable.id, id), eq(betsTable.userId, userId)));
    });
    return res.status(204).send();
  } catch (error) {
    if (error instanceof InsufficientTrackerBalanceError) {
      return void res.status(400).json({ error: "Wallet balance is too low to reverse this settled bet" });
    }
    throw error;
  }
});
