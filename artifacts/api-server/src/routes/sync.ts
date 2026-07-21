/**
 * Admin sync routes
 *   POST /api/sync/run    — trigger a manual sync immediately
 *   GET  /api/sync/status — last sync result + DB cache counts
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { syncLogTable, oddsCacheTable, playerStatsCacheTable } from "@workspace/db";
import { desc, count } from "drizzle-orm";
import { runDailySync } from "../services/dailySync";

export const syncRouter = Router();

// GET /sync/status
syncRouter.get("/status", async (_req, res) => {
  const [last] = await db
    .select()
    .from(syncLogTable)
    .orderBy(desc(syncLogTable.startedAt))
    .limit(1);

  const [oddsCount]  = await db.select({ n: count() }).from(oddsCacheTable);
  const [statsCount] = await db.select({ n: count() }).from(playerStatsCacheTable);

  const today5am = new Date();
  today5am.setHours(5, 0, 0, 0);
  const nextSync = new Date(today5am);
  if (nextSync <= new Date()) nextSync.setDate(nextSync.getDate() + 1);

  return res.json({
    lastSync:    last ?? null,
    nextSync:    nextSync.toISOString(),
    cacheSize:   { odds: Number(oddsCount?.n ?? 0), stats: Number(statsCount?.n ?? 0) },
  });
});

// POST /sync/run — manual trigger (returns immediately with job id)
let syncRunning = false;
syncRouter.post("/run", async (_req, res) => {
  if (syncRunning) {
    return res.status(409).json({ error: "Sync already in progress" });
  }
  syncRunning = true;
  // Fire-and-forget — respond immediately
  res.json({ ok: true, message: "Sync started — check /api/sync/status for results" });

  try {
    await runDailySync("manual");
  } finally {
    syncRunning = false;
  }
  return;
});
