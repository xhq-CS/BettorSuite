import { Router } from "express";
import { and, desc, eq, or } from "drizzle-orm";
import { db, followsTable, reportsTable, userBlocksTable, userNicknamesTable, usersTable } from "@workspace/db";
import type { AuthRequest } from "../middleware/auth";

export const publicSafetyRouter = Router();
export const safetyRouter = Router();
const currentUserId = (req: unknown) => (req as AuthRequest).userId;

function validEmail(value: string) {
  return /^\S+@\S+\.\S+$/.test(value);
}

publicSafetyRouter.post("/privacy-requests", async (req, res) => {
  const email = String(req.body.email ?? "").trim().toLowerCase();
  const category = String(req.body.category ?? "privacy-access").trim();
  const details = String(req.body.details ?? "").trim();
  if (!validEmail(email) || !["privacy-access", "privacy-correction", "privacy-deletion", "privacy-opt-out", "other"].includes(category) || details.length < 10 || details.length > 2000) {
    return void res.status(400).json({ error: "Add a valid email and a 10-2000 character request." });
  }
  await db.insert(reportsTable).values({ reporterEmail: email, targetType: "privacy-request", category, details });
  return res.status(201).json({ message: "Your privacy request has been received." });
});

safetyRouter.get("/blocks", async (req, res) => {
  const userId = currentUserId(req);
  const rows = await db.select({
    id: userBlocksTable.id,
    userId: usersTable.id,
    username: usersTable.username,
    displayName: usersTable.displayName,
    avatarUrl: usersTable.avatarUrl,
    createdAt: userBlocksTable.createdAt,
  }).from(userBlocksTable).innerJoin(usersTable, eq(userBlocksTable.blockedId, usersTable.id)).where(eq(userBlocksTable.blockerId, userId)).orderBy(desc(userBlocksTable.createdAt));
  return res.json(rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })));
});

safetyRouter.post("/blocks/:id", async (req, res) => {
  const blockerId = currentUserId(req);
  const blockedId = Number(req.params.id);
  if (!Number.isInteger(blockedId) || blockedId <= 0 || blockedId === blockerId) return void res.status(400).json({ error: "Choose another account." });
  const [target] = await db.select({ id: usersTable.id, role: usersTable.role }).from(usersTable).where(eq(usersTable.id, blockedId));
  if (!target) return void res.status(404).json({ error: "Account not found." });
  if (target.role === "admin") return void res.status(400).json({ error: "The platform administrator cannot be blocked." });
  await db.transaction(async (tx) => {
    await tx.insert(userBlocksTable).values({ blockerId, blockedId }).onConflictDoNothing();
    await tx.delete(followsTable).where(or(
      and(eq(followsTable.followerId, blockerId), eq(followsTable.followingId, blockedId)),
      and(eq(followsTable.followerId, blockedId), eq(followsTable.followingId, blockerId)),
    ));
    await tx.delete(userNicknamesTable).where(or(
      and(eq(userNicknamesTable.ownerId, blockerId), eq(userNicknamesTable.targetUserId, blockedId)),
      and(eq(userNicknamesTable.ownerId, blockedId), eq(userNicknamesTable.targetUserId, blockerId)),
    ));
  });
  return res.status(201).json({ blocked: true });
});

safetyRouter.delete("/blocks/:id", async (req, res) => {
  await db.delete(userBlocksTable).where(and(eq(userBlocksTable.blockerId, currentUserId(req)), eq(userBlocksTable.blockedId, Number(req.params.id))));
  return res.status(204).send();
});

safetyRouter.post("/reports", async (req, res) => {
  const reporterId = currentUserId(req);
  const targetType = String(req.body.targetType ?? "user").trim();
  const targetId = req.body.targetId == null ? null : String(req.body.targetId).slice(0, 120);
  const reportedUserId = req.body.reportedUserId == null ? null : Number(req.body.reportedUserId);
  const category = String(req.body.category ?? "other").trim();
  const details = String(req.body.details ?? "").trim();
  const allowedTargets = ["user", "war-room-post", "group-message", "direct-message", "group", "daily-card", "bet-slip"];
  const allowedCategories = ["harassment", "spam", "scam", "hate", "impersonation", "privacy", "underage", "other"];
  if (!allowedTargets.includes(targetType) || !allowedCategories.includes(category) || details.length < 10 || details.length > 2000) return void res.status(400).json({ error: "Choose a reason and add 10-2000 characters of detail." });
  if (reportedUserId === reporterId) return void res.status(400).json({ error: "You cannot report your own account." });
  const [report] = await db.insert(reportsTable).values({ reporterId, targetType, targetId, reportedUserId: Number.isInteger(reportedUserId) ? reportedUserId : null, category, details }).returning();
  return res.status(201).json({ id: report.id, message: "Report submitted for review." });
});
