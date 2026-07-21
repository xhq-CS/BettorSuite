import { Router } from "express";
import { db } from "@workspace/db";
import { simulatorWalletsTable, simulatorBetsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  ResetSimulatorWalletBody,
  CreateSimulatorBetBody,
  SettleSimulatorBetParams,
} from "@workspace/api-zod";
import type { AuthRequest } from "../middleware/auth";

export const simulatorRouter = Router();

const currentUserId = (req: unknown) => (req as AuthRequest).userId;

function calcPayout(wager: number, odds: number): number {
  if (odds > 0) {
    return wager + wager * (odds / 100);
  } else {
    return wager + wager * (100 / Math.abs(odds));
  }
}

type BetStatus = "pending" | "won" | "lost" | "push";
type BetFinancials = { balanceDelta: number; profitDelta: number; wins: number; losses: number; actualPayout: number | null };

function betFinancials(status: BetStatus, wager: number, potentialPayout: number): BetFinancials {
  if (status === "won") return { balanceDelta: potentialPayout - wager, profitDelta: potentialPayout - wager, wins: 1, losses: 0, actualPayout: potentialPayout };
  if (status === "lost") return { balanceDelta: -wager, profitDelta: -wager, wins: 0, losses: 1, actualPayout: 0 };
  if (status === "push") return { balanceDelta: 0, profitDelta: 0, wins: 0, losses: 0, actualPayout: wager };
  return { balanceDelta: -wager, profitDelta: 0, wins: 0, losses: 0, actualPayout: null };
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
      unitMode: "auto",
      customUnitSize: "10",
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
  const decidedBets = wins + losses;
  const winRate = decidedBets > 0 ? wins / decidedBets : 0;
  const automaticUnitSize = Math.max(0.01, Number(w.startingBalance) * 0.01);
  const unitSize = w.unitMode === "custom" ? Number(w.customUnitSize) : automaticUnitSize;
  return {
    id: w.id,
    userId: w.userId,
    balance: Number(w.balance),
    startingBalance: Number(w.startingBalance),
    unitMode: w.unitMode === "custom" ? "custom" : "auto",
    unitSize,
    customUnitSize: Number(w.customUnitSize),
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
  const wallet = await getOrCreateWallet(currentUserId(req));
  res.json(formatWallet(wallet));
});

// POST /simulator/wallet (reset)
simulatorRouter.post("/wallet", async (req, res) => {
  const body = ResetSimulatorWalletBody.parse(req.body);
  const startingBalance = body.startingBalance;

  // Delete all sim bets for this user
  await db
    .delete(simulatorBetsTable)
    .where(eq(simulatorBetsTable.userId, currentUserId(req)));

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
    .where(eq(simulatorWalletsTable.userId, currentUserId(req)))
    .returning();

  if (!wallet) {
    const [created] = await db
      .insert(simulatorWalletsTable)
      .values({
        userId: currentUserId(req),
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
  const { action, amount, unitMode, customUnitSize } = req.body as {
    action?: string;
    amount?: number;
    unitMode?: "auto" | "custom";
    customUnitSize?: number;
  };

  if (unitMode !== undefined || customUnitSize !== undefined) {
    if (unitMode !== "auto" && unitMode !== "custom") {
      return res.status(400).json({ error: "unitMode must be auto or custom" });
    }
    if (unitMode === "custom" && (typeof customUnitSize !== "number" || customUnitSize <= 0)) {
      return res.status(400).json({ error: "customUnitSize must be a positive number" });
    }

    const wallet = await getOrCreateWallet(currentUserId(req));
    const [updated] = await db
      .update(simulatorWalletsTable)
      .set({
        unitMode,
        customUnitSize: String(customUnitSize ?? Number(wallet.customUnitSize)),
        updatedAt: new Date(),
      })
      .where(eq(simulatorWalletsTable.userId, currentUserId(req)))
      .returning();

    return res.json(formatWallet(updated));
  }

  if (!action || !["set", "add", "subtract"].includes(action)) {
    return res.status(400).json({ error: "action must be set | add | subtract" });
  }
  if (typeof amount !== "number" || !Number.isFinite(amount) || (action === "set" ? amount < 0 : amount <= 0)) {
    return res.status(400).json({ error: action === "set" ? "amount must be zero or greater" : "amount must be a positive number" });
  }

  const wallet = await getOrCreateWallet(currentUserId(req));
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
    .where(eq(simulatorWalletsTable.userId, currentUserId(req)))
    .returning();

  return res.json(formatWallet(updated));
});

// GET /simulator/bets
simulatorRouter.get("/bets", async (req, res) => {
  const rows = await db
    .select()
    .from(simulatorBetsTable)
    .where(eq(simulatorBetsTable.userId, currentUserId(req)))
    .orderBy(desc(simulatorBetsTable.createdAt));

  res.json(rows.map(formatSimBet));
});

// POST /simulator/bets
simulatorRouter.post("/bets", async (req, res) => {
  const body = CreateSimulatorBetBody.parse(req.body);
  const wallet = await getOrCreateWallet(currentUserId(req));

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
    .where(eq(simulatorWalletsTable.userId, currentUserId(req)));

  const [bet] = await db
    .insert(simulatorBetsTable)
    .values({
      userId: currentUserId(req),
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

// PATCH /simulator/bets/:id - edit details and/or change settlement status
simulatorRouter.patch("/bets/:id", async (req, res) => {
  const { id } = SettleSimulatorBetParams.parse({ id: Number(req.params.id) });
  const requestedStatus = req.body.status === undefined ? undefined : String(req.body.status);
  if (requestedStatus && !["pending", "won", "lost", "push"].includes(requestedStatus)) {
    return void res.status(400).json({ error: "Invalid status" });
  }

  const [bet] = await db
    .select()
    .from(simulatorBetsTable)
    .where(eq(simulatorBetsTable.id, id));

  if (!bet) return void res.status(404).json({ error: "Bet not found" });
  if (bet.userId !== currentUserId(req)) return void res.status(403).json({ error: "You can only update your own bet" });

  const description = req.body.description === undefined ? bet.description : String(req.body.description).trim();
  const betType = req.body.betType === undefined ? bet.betType : String(req.body.betType).trim();
  const sport = req.body.sport === undefined ? bet.sport : String(req.body.sport).trim();
  const wager = req.body.wager === undefined ? Number(bet.wager) : Number(req.body.wager);
  const odds = req.body.odds === undefined ? Number(bet.odds) : Number(req.body.odds);
  const status = (requestedStatus ?? bet.status) as BetStatus;
  if (!description || !betType || !Number.isFinite(wager) || wager <= 0 || !Number.isFinite(odds) || odds === 0) {
    return void res.status(400).json({ error: "Description, bet type, positive wager, and non-zero odds are required" });
  }

  const wallet = await getOrCreateWallet(currentUserId(req));
  const oldFinancials = betFinancials(bet.status as BetStatus, Number(bet.wager), Number(bet.potentialPayout));
  const potentialPayout = calcPayout(wager, odds);
  const nextFinancials = betFinancials(status, wager, potentialPayout);
  const newBalance = Number(wallet.balance) - oldFinancials.balanceDelta + nextFinancials.balanceDelta;
  if (newBalance < 0) return void res.status(400).json({ error: "Insufficient balance for this change" });

  await db
    .update(simulatorWalletsTable)
    .set({
      balance: String(newBalance),
      wins: Math.max(0, wallet.wins - oldFinancials.wins + nextFinancials.wins),
      losses: Math.max(0, wallet.losses - oldFinancials.losses + nextFinancials.losses),
      totalProfit: String(Number(wallet.totalProfit) - oldFinancials.profitDelta + nextFinancials.profitDelta),
      updatedAt: new Date(),
    })
    .where(eq(simulatorWalletsTable.userId, currentUserId(req)));

  const [updated] = await db
    .update(simulatorBetsTable)
    .set({
      description,
      betType,
      sport: sport || null,
      wager: String(wager),
      odds: String(odds),
      potentialPayout: String(potentialPayout),
      status,
      actualPayout: nextFinancials.actualPayout === null ? null : String(nextFinancials.actualPayout),
    })
    .where(eq(simulatorBetsTable.id, id))
    .returning();

  res.json(formatSimBet(updated));
});

// DELETE /simulator/bets/:id - remove a bet and reverse its wallet effect
simulatorRouter.delete("/bets/:id", async (req, res) => {
  const { id } = SettleSimulatorBetParams.parse({ id: Number(req.params.id) });
  const [bet] = await db.select().from(simulatorBetsTable).where(eq(simulatorBetsTable.id, id));
  if (!bet) return void res.status(404).json({ error: "Bet not found" });
  if (bet.userId !== currentUserId(req)) return void res.status(403).json({ error: "You can only delete your own bet" });

  const wallet = await getOrCreateWallet(currentUserId(req));
  const financials = betFinancials(bet.status as BetStatus, Number(bet.wager), Number(bet.potentialPayout));
  await db.update(simulatorWalletsTable).set({
    balance: String(Number(wallet.balance) - financials.balanceDelta),
    totalBets: Math.max(0, wallet.totalBets - 1),
    wins: Math.max(0, wallet.wins - financials.wins),
    losses: Math.max(0, wallet.losses - financials.losses),
    totalProfit: String(Number(wallet.totalProfit) - financials.profitDelta),
    updatedAt: new Date(),
  }).where(eq(simulatorWalletsTable.userId, currentUserId(req)));
  await db.delete(simulatorBetsTable).where(eq(simulatorBetsTable.id, id));
  return res.status(204).send();
});
