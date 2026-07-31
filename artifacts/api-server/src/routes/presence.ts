import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import type { AuthRequest } from "../middleware/auth";
import type { PresenceStatus } from "../lib/presence";

export const presenceRouter = Router();
const currentUserId = (req: unknown) => (req as AuthRequest).userId;
const validStatuses = new Set<PresenceStatus>(["online", "idle", "offline"]);

presenceRouter.post("/", async (req, res) => {
  const status = String(req.body.status ?? "") as PresenceStatus;
  if (!validStatuses.has(status)) {
    return void res.status(400).json({ error: "Invalid presence status" });
  }

  await db
    .update(usersTable)
    .set({ presenceStatus: status, presenceUpdatedAt: new Date() })
    .where(eq(usersTable.id, currentUserId(req)));

  return res.json({ status });
});
