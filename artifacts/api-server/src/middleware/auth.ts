import type { NextFunction, Request, Response } from "express";
import { createHash } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db, sessionsTable, usersTable } from "@workspace/db";

export type AuthRequest = Request & { userId: number };

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.bettorstats_session as string | undefined;
  if (!token) return void res.status(401).json({ error: "Authentication required" });
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const [session] = await db.select().from(sessionsTable).where(and(
    eq(sessionsTable.tokenHash, tokenHash),
    eq(sessionsTable.revoked, false),
    gt(sessionsTable.expiresAt, new Date()),
  ));
  if (!session) return void res.status(401).json({ error: "Session expired" });
  (req as AuthRequest).userId = session.userId;
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const userId = (req as AuthRequest).userId;
  const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId));
  if (user?.role !== "admin") return void res.status(403).json({ error: "Administrator access required" });
  next();
}
