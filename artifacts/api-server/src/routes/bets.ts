import { Router } from "express";
import { db } from "@workspace/db";
import { betsTable, publicBetRevisionsTable, usersTable } from "@workspace/db";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import {
  CreateBetBody,
  UpdateBetParams,
  DeleteBetParams,
  ListBetsQueryParams,
} from "@workspace/api-zod";
import type { AuthRequest } from "../middleware/auth";
import { trackerBetSnapshot } from "../lib/betSnapshots";

export const betsRouter = Router();

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

function calcPayout(wager: number, odds: number, profitBoostPercent = 0): number {
  const baseProfit = odds > 0
    ? wager * (odds / 100)
    : wager * (100 / Math.abs(odds));
  return roundMoney(wager + baseProfit * (1 + profitBoostPercent / 100));
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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
    potentialPayout: Number(b.potentialPayout),
    actualPayout: b.actualPayout !== null ? Number(b.actualPayout) : null,
    status: b.status,
    sport: b.sport ?? null,
    playerName: b.playerName ?? null,
    notes: b.notes ?? null,
    createdAt: b.createdAt.toISOString(),
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
  const [rows, [user]] = await Promise.all([
    db.select().from(betsTable).where(eq(betsTable.userId, userId)),
    db.select({ wageredResetAt: usersTable.trackerWageredResetAt }).from(usersTable).where(eq(usersTable.id, userId)),
  ]);

  const settled = rows.filter((b) => ["won", "lost", "push"].includes(b.status));
  const wins = settled.filter((b) => b.status === "won").length;
  const losses = settled.filter((b) => b.status === "lost").length;
  const pushes = settled.filter((b) => b.status === "push").length;
  const wageredRows = user?.wageredResetAt
    ? rows.filter(bet => bet.createdAt > user.wageredResetAt!)
    : rows;
  const totalWagered = wageredRows.reduce((sum, b) => sum + Number(b.wager), 0);
  const settledWagered = settled.reduce((sum, b) => sum + Number(b.wager), 0);
  const totalProfit = settled.reduce((sum, b) => {
    if (b.status === "won") return sum + Number(b.actualPayout ?? b.potentialPayout) - Number(b.wager);
    if (b.status === "lost") return sum - Number(b.wager);
    return sum;
  }, 0);
  const decidedBets = wins + losses;
  const winRate = decidedBets > 0 ? wins / decidedBets : 0;
  const roi = settledWagered > 0 ? totalProfit / settledWagered : 0;

  res.json({
    totalBets: rows.length,
    wins,
    losses,
    pushes,
    winRate,
    totalWagered,
    totalProfit,
    roi,
  });
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
  const [user] = await db
    .select({ balance: usersTable.trackerBankroll })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) return void res.status(404).json({ error: "User not found" });
  return res.json({ balance: roundMoney(Number(user.balance)) });
});

// PATCH /bets/wallet — manually match the user's sportsbook balance
betsRouter.patch("/wallet", async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId;
  const requestedBalance = Number(req.body.balance);
  if (!Number.isFinite(requestedBalance) || requestedBalance < 0) {
    return void res.status(400).json({ error: "Balance must be zero or greater" });
  }
  const balance = roundMoney(requestedBalance);

  const [user] = await db
    .update(usersTable)
    .set({ trackerBankroll: String(balance) })
    .where(eq(usersTable.id, userId))
    .returning({ balance: usersTable.trackerBankroll });

  if (!user) return void res.status(404).json({ error: "User not found" });
  return res.json({ balance: Number(user.balance) });
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
  const profitBoostPercent = body.profitBoostPercent ?? 0;
  if (!body.description.trim() || !Number.isFinite(wager) || wager <= 0 || !Number.isFinite(odds) || odds === 0 || !Number.isFinite(profitBoostPercent) || profitBoostPercent < 0 || profitBoostPercent > 1000) {
    return void res.status(400).json({ error: "Valid description, wager, and odds are required" });
  }
  const potentialPayout = calcPayout(wager, odds, profitBoostPercent);
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
          potentialPayout: String(potentialPayout),
          status: "pending",
          walletReserved: true,
          sport: isParlay ? "Multiple" : (body.sport ?? null),
          playerName: body.playerName ?? null,
          notes: body.notes ?? null,
        })
        .returning();
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
  const betType = req.body.betType === undefined ? existing.betType : String(req.body.betType).trim();
  const sportsbook = req.body.sportsbook === undefined ? existing.sportsbook : String(req.body.sportsbook).trim();
  const sport = req.body.sport === undefined ? existing.sport : String(req.body.sport).trim();
  const notes = req.body.notes === undefined ? existing.notes : String(req.body.notes);
  const wager = req.body.wager === undefined ? Number(existing.wager) : Number(req.body.wager);
  let parlayLegs: ParlayLeg[];
  try { parlayLegs = req.body.parlayLegs === undefined ? existing.parlayLegs : normalizeParlayLegs(req.body.parlayLegs); }
  catch (error) { return void res.status(400).json({ error: error instanceof Error ? error.message : "Invalid parlay" }); }
  const isParlay = betType === "parlay" || parlayLegs.length > 0;
  if (isParlay && parlayLegs.length < 2) return void res.status(400).json({ error: "A parlay requires at least two legs" });
  if (!isParlay) parlayLegs = [];
  const odds = isParlay ? calcParlayOdds(parlayLegs) : (req.body.odds === undefined ? Number(existing.odds) : Number(req.body.odds));
  const profitBoostPercent = req.body.profitBoostPercent === undefined ? Number(existing.profitBoostPercent) : Number(req.body.profitBoostPercent);
  const status = req.body.status === undefined ? existing.status : String(req.body.status);
  if (!description || !betType || !Number.isFinite(wager) || wager <= 0 || !Number.isFinite(odds) || odds === 0 || !Number.isFinite(profitBoostPercent) || profitBoostPercent < 0 || profitBoostPercent > 1000 || !["pending", "won", "lost", "push", "void"].includes(status)) {
    return void res.status(400).json({ error: "Valid description, bet type, wager, odds, and status are required" });
  }
  const potentialPayout = calcPayout(wager, odds, profitBoostPercent);
  const actualPayout = status === "won" ? potentialPayout : status === "push" ? wager : status === "pending" ? null : 0;
  const previousBalanceDelta = trackerBalanceDelta(existing.status, Number(existing.wager), Number(existing.potentialPayout), existing.actualPayout === null ? null : Number(existing.actualPayout), existing.walletReserved);
  const nextBalanceDelta = trackerBalanceDelta(status, wager, potentialPayout, actualPayout, existing.walletReserved);
  const walletChange = roundMoney(nextBalanceDelta - previousBalanceDelta);

  const updates: Partial<typeof betsTable.$inferInsert> = {
    description, betType: isParlay ? "parlay" : betType, sportsbook: sportsbook || null, sport: isParlay ? "Multiple" : (sport || null), notes,
    wager: String(wager), odds: String(odds), parlayLegs, profitBoostPercent: String(profitBoostPercent), potentialPayout: String(potentialPayout),
    status, actualPayout: actualPayout === null ? null : String(actualPayout),
    updatedAt: new Date(),
    settledAt: status === "pending" ? null : new Date(),
  };

  try {
    const bet = await db.transaction(async (tx) => {
      if (walletChange < -0.000001) {
        const required = Math.abs(walletChange);
        const [wallet] = await tx
          .update(usersTable)
          .set({ trackerBankroll: sql`${usersTable.trackerBankroll} - ${required}` })
          .where(and(eq(usersTable.id, userId), gte(usersTable.trackerBankroll, String(required))))
          .returning({ balance: usersTable.trackerBankroll });
        if (!wallet) throw new InsufficientTrackerBalanceError();
      } else if (walletChange > 0.000001) {
        await tx
          .update(usersTable)
          .set({ trackerBankroll: sql`${usersTable.trackerBankroll} + ${walletChange}` })
          .where(eq(usersTable.id, userId));
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
        await tx
          .update(usersTable)
          .set({ trackerBankroll: sql`${usersTable.trackerBankroll} + ${walletChange}` })
          .where(eq(usersTable.id, userId));
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
