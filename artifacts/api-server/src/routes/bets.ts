import { Router } from "express";
import { db } from "@workspace/db";
import { betsTable, usersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import {
  CreateBetBody,
  UpdateBetParams,
  DeleteBetParams,
  ListBetsQueryParams,
} from "@workspace/api-zod";
import type { AuthRequest } from "../middleware/auth";

export const betsRouter = Router();

function calcPayout(wager: number, odds: number): number {
  if (odds > 0) {
    return wager + wager * (odds / 100);
  } else {
    return wager + wager * (100 / Math.abs(odds));
  }
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function trackerResultProfit(status: string, wager: number, potentialPayout: number, actualPayout?: number | null) {
  if (status === "won") return Number(actualPayout ?? potentialPayout) - wager;
  if (status === "lost") return -wager;
  return 0;
}

async function adjustTrackerBankroll(userId: number, delta: number) {
  if (Math.abs(delta) < 0.000001) return;
  const [user] = await db.select({ balance: usersTable.trackerBankroll }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user) return;
  await db.update(usersTable).set({ trackerBankroll: String(roundMoney(Number(user.balance) + delta)) }).where(eq(usersTable.id, userId));
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
    potentialPayout: Number(b.potentialPayout),
    actualPayout: b.actualPayout !== null ? Number(b.actualPayout) : null,
    status: b.status,
    sport: b.sport ?? null,
    playerName: b.playerName ?? null,
    notes: b.notes ?? null,
    createdAt: b.createdAt.toISOString(),
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
  const odds = body.odds;
  const potentialPayout = calcPayout(wager, odds);

  const [bet] = await db
    .insert(betsTable)
    .values({
      userId,
      description: body.description,
      betType: body.betType,
      sportsbook: body.sportsbook ?? null,
      wager: String(wager),
      odds: String(odds),
      potentialPayout: String(potentialPayout),
      status: "pending",
      sport: body.sport ?? null,
      playerName: body.playerName ?? null,
      notes: body.notes ?? null,
    })
    .returning();

  res.status(201).json(formatBet(bet));
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
  const odds = req.body.odds === undefined ? Number(existing.odds) : Number(req.body.odds);
  const status = req.body.status === undefined ? existing.status : String(req.body.status);
  if (!description || !betType || !Number.isFinite(wager) || wager <= 0 || !Number.isFinite(odds) || odds === 0 || !["pending", "won", "lost", "push", "void"].includes(status)) {
    return void res.status(400).json({ error: "Valid description, bet type, wager, odds, and status are required" });
  }
  const potentialPayout = calcPayout(wager, odds);
  const actualPayout = status === "won" ? potentialPayout : status === "push" ? wager : status === "pending" ? null : 0;
  const previousProfit = trackerResultProfit(existing.status, Number(existing.wager), Number(existing.potentialPayout), existing.actualPayout === null ? null : Number(existing.actualPayout));
  const nextProfit = trackerResultProfit(status, wager, potentialPayout, actualPayout);

  const updates: Partial<typeof betsTable.$inferInsert> = {
    description, betType, sportsbook: sportsbook || null, sport: sport || null, notes,
    wager: String(wager), odds: String(odds), potentialPayout: String(potentialPayout),
    status, actualPayout: actualPayout === null ? null : String(actualPayout),
    settledAt: status === "pending" ? null : new Date(),
  };

  const [bet] = await db
    .update(betsTable)
    .set(updates)
    .where(and(eq(betsTable.id, id), eq(betsTable.userId, userId)))
    .returning();

  await adjustTrackerBankroll(userId, nextProfit - previousProfit);

  return res.json(formatBet(bet));
});

// DELETE /bets/:id
betsRouter.delete("/:id", async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId;
  const { id } = DeleteBetParams.parse({ id: Number(req.params.id) });
  const [existing] = await db.select().from(betsTable).where(and(eq(betsTable.id, id), eq(betsTable.userId, userId)));
  await db
    .delete(betsTable)
    .where(and(eq(betsTable.id, id), eq(betsTable.userId, userId)));
  if (existing) {
    const previousProfit = trackerResultProfit(existing.status, Number(existing.wager), Number(existing.potentialPayout), existing.actualPayout === null ? null : Number(existing.actualPayout));
    await adjustTrackerBankroll(userId, -previousProfit);
  }
  res.status(204).send();
});
