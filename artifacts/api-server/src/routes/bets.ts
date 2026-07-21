import { Router } from "express";
import { db } from "@workspace/db";
import { betsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import {
  CreateBetBody,
  UpdateBetBody,
  UpdateBetParams,
  DeleteBetParams,
  ListBetsQueryParams,
} from "@workspace/api-zod";

export const betsRouter = Router();

const DEFAULT_USER_ID = 1;

function calcPayout(wager: number, odds: number): number {
  if (odds > 0) {
    return wager + wager * (odds / 100);
  } else {
    return wager + wager * (100 / Math.abs(odds));
  }
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
  const query = ListBetsQueryParams.parse(req.query);
  const conditions = [eq(betsTable.userId, DEFAULT_USER_ID)];
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
  const rows = await db
    .select()
    .from(betsTable)
    .where(eq(betsTable.userId, DEFAULT_USER_ID));

  const settled = rows.filter((b) => ["won", "lost", "push"].includes(b.status));
  const wins = settled.filter((b) => b.status === "won").length;
  const losses = settled.filter((b) => b.status === "lost").length;
  const pushes = settled.filter((b) => b.status === "push").length;
  const totalWagered = rows.reduce((sum, b) => sum + Number(b.wager), 0);
  const totalReturned = rows
    .filter((b) => b.actualPayout !== null)
    .reduce((sum, b) => sum + Number(b.actualPayout), 0);
  const totalProfit = totalReturned - totalWagered;
  const winRate = settled.length > 0 ? wins / settled.length : 0;
  const roi = totalWagered > 0 ? totalProfit / totalWagered : 0;

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

// POST /bets
betsRouter.post("/", async (req, res) => {
  const body = CreateBetBody.parse(req.body);
  const wager = body.wager;
  const odds = body.odds;
  const potentialPayout = calcPayout(wager, odds);

  const [bet] = await db
    .insert(betsTable)
    .values({
      userId: DEFAULT_USER_ID,
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
  const { id } = UpdateBetParams.parse({ id: Number(req.params.id) });
  const body = UpdateBetBody.parse(req.body);

  const updates: Partial<typeof betsTable.$inferInsert> = {};
  if (body.status) updates.status = body.status;
  if (body.actualPayout !== undefined) updates.actualPayout = String(body.actualPayout);
  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.status && body.status !== "pending") updates.settledAt = new Date();

  const [bet] = await db
    .update(betsTable)
    .set(updates)
    .where(and(eq(betsTable.id, id), eq(betsTable.userId, DEFAULT_USER_ID)))
    .returning();

  if (!bet) return void res.status(404).json({ error: "Bet not found" });
  return res.json(formatBet(bet));
});

// DELETE /bets/:id
betsRouter.delete("/:id", async (req, res) => {
  const { id } = DeleteBetParams.parse({ id: Number(req.params.id) });
  await db
    .delete(betsTable)
    .where(and(eq(betsTable.id, id), eq(betsTable.userId, DEFAULT_USER_ID)));
  res.status(204).send();
});
