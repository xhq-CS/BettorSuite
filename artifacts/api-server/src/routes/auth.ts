import { Router } from "express";
import { createHash, randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, sessionsTable, usersTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { hashPassword, verifyPassword } from "../lib/passwords";

export const authRouter = Router();
const COOKIE = "bettorstats_session";
const SESSION_MS = 1000 * 60 * 60 * 24 * 30;

async function createSession(userId: number, res: Parameters<typeof authRouter.post>[1] extends never ? never : any) {
  const token = randomBytes(32).toString("base64url");
  await db.insert(sessionsTable).values({ userId, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + SESSION_MS) });
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: SESSION_MS, path: "/" });
}

authRouter.post("/register", async (req, res) => {
  const email = String(req.body.email ?? "").trim().toLowerCase();
  const username = String(req.body.username ?? "").trim().toLowerCase();
  const password = String(req.body.password ?? "");
  if (!/^\S+@\S+\.\S+$/.test(email) || !/^[a-z0-9_]{3,24}$/.test(username) || password.length < 10 || password.length > 128 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return void res.status(400).json({ error: "Use a valid email, a 3–24 character username, and a 10–128 character password containing a letter and number." });
  }
  const existingEmail = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email));
  if (existingEmail.length) return void res.status(409).json({ error: "An account with that email already exists." });
  const existingUsername = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, username));
  if (existingUsername.length) return void res.status(409).json({ error: "That username is already taken." });
  const [user] = await db.insert(usersTable).values({ email, username, displayName: username, passwordHash: await hashPassword(password) }).returning();
  await createSession(user.id, res);
  return res.status(201).json({ id: user.id, email: user.email, username: user.username, displayName: user.displayName, role: user.role });
});

authRouter.post("/login", async (req, res) => {
  const email = String(req.body.email ?? "").trim().toLowerCase();
  const password = String(req.body.password ?? "");
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) return void res.status(401).json({ error: "Invalid email or password." });
  await createSession(user.id, res);
  return res.json({ id: user.id, email: user.email, username: user.username, displayName: user.displayName, role: user.role });
});

authRouter.post("/admin-login", async (req, res) => {
  const email = String(req.body.email ?? "").trim().toLowerCase();
  const password = String(req.body.password ?? "");
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user?.passwordHash || user.role !== "admin" || !(await verifyPassword(password, user.passwordHash))) {
    return void res.status(401).json({ error: "Invalid administrator credentials." });
  }
  await createSession(user.id, res);
  return res.json({ id: user.id, email: user.email, username: user.username, displayName: user.displayName, role: user.role });
});

authRouter.post("/logout", requireAuth, async (req, res) => {
  const token = req.cookies?.[COOKIE] as string;
  await db.update(sessionsTable).set({ revoked: true }).where(and(eq(sessionsTable.userId, (req as AuthRequest).userId), eq(sessionsTable.tokenHash, createHash("sha256").update(token).digest("hex"))));
  res.clearCookie(COOKIE, { path: "/" });
  return res.status(204).send();
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, (req as AuthRequest).userId));
  if (!user) return void res.status(401).json({ error: "Account not found" });
  return res.json({ id: user.id, email: user.email, username: user.username, displayName: user.displayName, role: user.role });
});
