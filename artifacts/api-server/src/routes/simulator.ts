import { Router } from "express";
import { db } from "@workspace/db";
import { simulatorWalletsTable, simulatorBetsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  ResetSimulatorWalletBody,
  CreateSimulatorBetBody,
  SettleSimulatorBetBody,
  SettleSimulatorBetParams,
} from "@workspace/api-zod";

export const simulatorRouter = Router();

const DEFAULT_USER_ID = 1;

function calcPayout(wager: number, odds: number): number {
  if (odds > 0) {
    return wager + wager * (odds / 100);
  } else {
    return wager + wager * (100 / Math.abs(odds));
  }
}

async function getOrCreateWallet(userId: number) {
  const [existing] = await db
    .select()
    .from(simulatorWalletsTable)
    .where(eq(simulatorWalletsTable.userId, userId));

  if (existing) return existing;

  const [created] = await db
    .insert(simulatorWalletsTable)
    .values({
      userId,
      balance: "1000",
      startingBalance: "1000",
      totalBets: 0,
      wins: 0,
      losses: 0,
      totalProfit: "0",
    })
    .returning();

  return created;
}

function formatWallet(w: typeof simulatorWalletsTable.$inferSelect) {
  const wins = w.wins;
  const losses = w.losses;
  const totalBets = w.totalBets;
  const winRate = totalBets > 0 ? wins / totalBets : 0;
  return {
    id: w.id,
    userId: w.userId,
    balance: Number(w.balance),
    startingBalance: Number(w.startingBalance),
    totalBets,
    wins,
    losses,
    totalProfit: Number(w.totalProfit),
    winRate,
  };
}

function formatSimBet(b: typeof simulatorBetsTable.$inferSelect) {
  return {
    id: b.id,
    userId: b.userId,
    description: b.description,
    betType: b.betType,
    wager: Number(b.wager),
    odds: Number(b.odds),
    potentialPayout: Number(b.potentialPayout),
    actualPayout: b.actualPayout !== null ? Number(b.actualPayout) : null,
    status: b.status,
    sport: b.sport ?? null,
    playerName: b.playerName ?? null,
    createdAt: b.createdAt.toISOString(),
  };
}

// GET /simulator/wallet
simulatorRouter.get("/wallet", async (req, res) => {
  const wallet = await getOrCreateWallet(DEFAULT_USER_ID);
  res.json(formatWallet(wallet));
});

// POST /simulator/wallet (reset)
simulatorRouter.post("/wallet", async (req, res) => {
  const body = ResetSimulatorWalletBody.parse(req.body);
  const startingBalance = body.startingBalance;

  // Delete all sim bets for this user
  await db
    .delete(simulatorBetsTable)
    .where(eq(simulatorBetsTable.userId, DEFAULT_USER_ID));

  const [wallet] = await db
    .update(simulatorWalletsTable)
    .set({
      balance: String(startingBalance),
      startingBalance: String(startingBalance),
      totalBets: 0,
      wins: 0,
      losses: 0,
      totalProfit: "0",
      updatedAt: new Date(),
    })
    .where(eq(simulatorWalletsTable.userId, DEFAULT_USER_ID))
    .returning();

  if (!wallet) {
    const [created] = await db
      .insert(simulatorWalletsTable)
      .values({
        userId: DEFAULT_USER_ID,
        balance: String(startingBalance),
        startingBalance: String(startingBalance),
        totalBets: 0,
        wins: 0,
        losses: 0,
        totalProfit: "0",
      })
      .returning();
    return res.json(formatWallet(created));
  }

  return res.json(formatWallet(wallet));
});

// PATCH /simulator/wallet — adjust balance without resetting history
simulatorRouter.patch("/wallet", async (req, res) => {
  const { action, amount } = req.body as { action: string; amount: number };
  if (!["set", "add", "subtract"].includes(action)) {
    return res.status(400).json({ error: "action must be set | add | subtract" });
  }
  if (typeof amount !== "number" || amount <= 0) {
    return res.status(400).json({ error: "amount must be a positive number" });
  }

  const wallet = await getOrCreateWallet(DEFAULT_USER_ID);
  let newBalance: number;

  switch (action) {
    case "set":      newBalance = amount; break;
    case "add":      newBalance = Number(wallet.balance) + amount; break;
    case "subtract": newBalance = Math.max(0, Number(wallet.balance) - amount); break;
    default:         newBalance = Number(wallet.balance);
  }

  const [updated] = await db
    .update(simulatorWalletsTable)
    .set({ balance: String(newBalance), updatedAt: new Date() })
    .where(eq(simulatorWalletsTable.userId, DEFAULT_USER_ID))
    .returning();

  return res.json(formatWallet(updated));
});

// GET /simulator/bets
simulatorRouter.get("/bets", async (req, res) => {
  const rows = await db
    .select()
    .from(simulatorBetsTable)
    .where(eq(simulatorBetsTable.userId, DEFAULT_USER_ID))
    .orderBy(desc(simulatorBetsTable.createdAt));

  res.json(rows.map(formatSimBet));
});

// POST /simulator/bets
simulatorRouter.post("/bets", async (req, res) => {
  const body = CreateSimulatorBetBody.parse(req.body);
  const wallet = await getOrCreateWallet(DEFAULT_USER_ID);

  const wager = body.wager;
  const balance = Number(wallet.balance);

  if (wager > balance) {
    return void res.status(400).json({ error: "Insufficient balance" });
  }

  const potentialPayout = calcPayout(wager, body.odds);

  // Deduct wager from wallet
  await db
    .update(simulatorWalletsTable)
    .set({
      balance: String(balance - wager),
      totalBets: wallet.totalBets + 1,
      updatedAt: new Date(),
    })
    .where(eq(simulatorWalletsTable.userId, DEFAULT_USER_ID));

  const [bet] = await db
    .insert(simulatorBetsTable)
    .values({
      userId: DEFAULT_USER_ID,
      description: body.description,
      betType: body.betType,
      wager: String(wager),
      odds: String(body.odds),
      potentialPayout: String(potentialPayout),
      status: "pending",
      sport: body.sport ?? null,
      playerName: body.playerName ?? null,
    })
    .returning();

  res.status(201).json(formatSimBet(bet));
});

// PATCH /simulator/bets/:id
simulatorRouter.patch("/bets/:id", async (req, res) => {
  const { id } = SettleSimulatorBetParams.parse({ id: Number(req.params.id) });
  const body = SettleSimulatorBetBody.parse(req.body);

  const [bet] = await db
    .select()
    .from(simulatorBetsTable)
    .where(eq(simulatorBetsTable.id, id));

  if (!bet) return void res.status(404).json({ error: "Bet not found" });
  if (bet.status !== "pending")
    return void res.status(400).json({ error: "Bet already settled" });

  const wallet = await getOrCreateWallet(DEFAULT_USER_ID);
  const currentBalance = Number(wallet.balance);
  const potentialPayout = Number(bet.potentialPayout);
  const wager = Number(bet.wager);

  let newBalance = currentBalance;
  let actualPayout = 0;
  let wonIncrement = 0;
  let lossIncrement = 0;
  let profitDelta = 0;

  if (body.status === "won") {
    actualPayout = potentialPayout;
    newBalance = currentBalance + potentialPayout;
    wonIncrement = 1;
    profitDelta = potentialPayout - wager;
  } else if (body.status === "lost") {
    actualPayout = 0;
    lossIncrement = 1;
    profitDelta = -wager;
  } else {
    // push - return wager
    actualPayout = wager;
    newBalance = currentBalance + wager;
    profitDelta = 0;
  }

  await db
    .update(simulatorWalletsTable)
    .set({
      balance: String(newBalance),
      wins: wallet.wins + wonIncrement,
      losses: wallet.losses + lossIncrement,
      totalProfit: String(Number(wallet.totalProfit) + profitDelta),
      updatedAt: new Date(),
    })
    .where(eq(simulatorWalletsTable.userId, DEFAULT_USER_ID));

  const [updated] = await db
    .update(simulatorBetsTable)
    .set({
      status: body.status,
      actualPayout: String(actualPayout),
    })
    .where(eq(simulatorBetsTable.id, id))
    .returning();

  res.json(formatSimBet(updated));
});
