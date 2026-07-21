/**
 * API-Sports proxy — serves from DB cache populated by daily 5am sync.
 * No live API-Sports calls are made here (100 req/day limit is used by the sync job).
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { playerStatsCacheTable, syncLogTable } from "@workspace/db";
import { and, eq, ilike, desc } from "drizzle-orm";

export const apiSportsRouter = Router();

// GET /sports-ref/status — cache stats + last sync info
apiSportsRouter.get("/status", async (_req, res) => {
  const [last] = await db
    .select()
    .from(syncLogTable)
    .orderBy(desc(syncLogTable.startedAt))
    .limit(1);

  const today5am = new Date();
  today5am.setHours(5, 0, 0, 0);
  const nextSync = new Date(today5am);
  if (nextSync <= new Date()) nextSync.setDate(nextSync.getDate() + 1);

  return res.json({
    available:   true,
    lastSync:    last ?? null,
    nextSync:    nextSync.toISOString(),
    dataSource:  "db_cache",
  });
});

// GET /sports-ref/player?sport=NBA&name=LeBron+James
// Returns cached season stats for the closest matching player.
apiSportsRouter.get("/player", async (req, res) => {
  const sport = (req.query.sport as string | undefined)?.toUpperCase() ?? "";
  const name  = (req.query.name  as string | undefined) ?? "";

  if (!sport || !name) {
    return res.status(400).json({ error: "sport and name are required" });
  }

  // Try exact match first, then ILIKE
  let rows = await db
    .select()
    .from(playerStatsCacheTable)
    .where(and(eq(playerStatsCacheTable.sport, sport), ilike(playerStatsCacheTable.playerName, name)))
    .limit(3);

  if (!rows.length) {
    // Partial: last-name only
    const parts = name.trim().split(/\s+/);
    const lastName = parts[parts.length - 1];
    rows = await db
      .select()
      .from(playerStatsCacheTable)
      .where(and(eq(playerStatsCacheTable.sport, sport), ilike(playerStatsCacheTable.playerName, `%${lastName}%`)))
      .limit(3);
  }

  if (!rows.length) {
    return res.json({ available: true, found: false, data: null });
  }

  const row = rows[0];
  return res.json({
    available: true,
    found:     true,
    player: {
      id:       row.apiPlayerId,
      name:     row.playerName,
      team:     row.teamName,
      position: row.position,
      sport:    row.sport,
    },
    stats:      row.statsJson,
    cachedAt:   row.fetchedAt.toISOString(),
    dataSource: "db_cache",
  });
});

// GET /sports-ref/leaders?sport=NBA — all cached players for a sport
apiSportsRouter.get("/leaders", async (req, res) => {
  const sport = (req.query.sport as string | undefined)?.toUpperCase() ?? "";
  if (!sport) return res.status(400).json({ error: "sport is required" });

  const rows = await db
    .select()
    .from(playerStatsCacheTable)
    .where(eq(playerStatsCacheTable.sport, sport))
    .orderBy(desc(playerStatsCacheTable.fetchedAt))
    .limit(200);

  return res.json({
    available:  true,
    sport,
    count:      rows.length,
    data:       rows,
    dataSource: "db_cache",
  });
});
