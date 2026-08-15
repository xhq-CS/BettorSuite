import { Router, type Request, type Response } from "express";
import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gt, isNull, ne } from "drizzle-orm";
import { db, passwordResetTokensTable, sessionsTable, usersTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { hashPassword, verifyPassword } from "../lib/passwords";
import { sendPasswordResetEmail } from "../lib/email";

export const authRouter = Router();
const COOKIE = "bettorstats_session";
const SESSION_MS = 1000 * 60 * 60 * 24 * 30;

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function requestIp(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  return String(Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0] ?? req.ip ?? "").trim().slice(0, 80) || null;
}

async function createSession(userId: number, req: Request, res: Response) {
  const token = randomBytes(32).toString("base64url");
  await db.insert(sessionsTable).values({
    userId,
    tokenHash: tokenHash(token),
    expiresAt: new Date(Date.now() + SESSION_MS),
    userAgent: String(req.headers["user-agent"] ?? "").slice(0, 500) || null,
    ipAddress: requestIp(req),
    lastSeenAt: new Date(),
  });
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: SESSION_MS, path: "/" });
}

authRouter.post("/register", async (req, res) => {
  const email = String(req.body.email ?? "").trim().toLowerCase();
  const username = String(req.body.username ?? "").trim().toLowerCase();
  const password = String(req.body.password ?? "");
  const acceptedTerms = req.body.acceptedTerms === true;
  const ageConfirmed = req.body.ageConfirmed === true;
  if (!/^\S+@\S+\.\S+$/.test(email) || !/^[a-z0-9_]{3,24}$/.test(username) || password.length < 10 || password.length > 128 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return void res.status(400).json({ error: "Use a valid email, a 3–24 character username, and a 10–128 character password containing a letter and number." });
  }
  if (!acceptedTerms || !ageConfirmed) return void res.status(400).json({ error: "Accept the Terms and Privacy Policy and confirm you meet the legal age requirement." });
  const existingEmail = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email));
  if (existingEmail.length) return void res.status(409).json({ error: "An account with that email already exists." });
  const existingUsername = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, username));
  if (existingUsername.length) return void res.status(409).json({ error: "That username is already taken." });
  const acceptedAt = new Date();
  const [user] = await db.insert(usersTable).values({ email, username, displayName: username, passwordHash: await hashPassword(password), termsAcceptedAt: acceptedAt, privacyAcceptedAt: acceptedAt, ageConfirmedAt: acceptedAt }).returning();
  await createSession(user.id, req, res);
  return res.status(201).json({ id: user.id, email: user.email, username: user.username, displayName: user.displayName, role: user.role });
});

authRouter.post("/login", async (req, res) => {
  const email = String(req.body.email ?? "").trim().toLowerCase();
  const password = String(req.body.password ?? "");
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) return void res.status(401).json({ error: "Invalid email or password." });
  await createSession(user.id, req, res);
  return res.json({ id: user.id, email: user.email, username: user.username, displayName: user.displayName, role: user.role });
});

authRouter.post("/admin-login", async (req, res) => {
  const email = String(req.body.email ?? "").trim().toLowerCase();
  const password = String(req.body.password ?? "");
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user?.passwordHash || user.role !== "admin" || !(await verifyPassword(password, user.passwordHash))) {
    return void res.status(401).json({ error: "Invalid administrator credentials." });
  }
  await createSession(user.id, req, res);
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

authRouter.post("/forgot-password", async (req, res) => {
  const email = String(req.body.email ?? "").trim().toLowerCase();
  const generic = { message: "If that email belongs to an account, a reset link is on its way." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.json(generic);
  const [user] = await db.select({ id: usersTable.id, email: usersTable.email }).from(usersTable).where(eq(usersTable.email, email));
  if (!user?.email) return res.json(generic);

  await db.update(passwordResetTokensTable).set({ usedAt: new Date() }).where(and(eq(passwordResetTokensTable.userId, user.id), isNull(passwordResetTokensTable.usedAt)));
  const token = randomBytes(32).toString("base64url");
  await db.insert(passwordResetTokensTable).values({ userId: user.id, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 30 * 60 * 1000) });
  const origin = (process.env.APP_ORIGIN || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
  await sendPasswordResetEmail({ to: user.email, resetUrl: `${origin}/reset-password?token=${encodeURIComponent(token)}` });
  return res.json(generic);
});

authRouter.post("/reset-password", async (req, res) => {
  const token = String(req.body.token ?? "");
  const password = String(req.body.password ?? "");
  if (!token || password.length < 10 || password.length > 128 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return void res.status(400).json({ error: "Use a 10-128 character password containing a letter and number." });
  }
  const [reset] = await db.select().from(passwordResetTokensTable).where(and(
    eq(passwordResetTokensTable.tokenHash, tokenHash(token)),
    isNull(passwordResetTokensTable.usedAt),
    gt(passwordResetTokensTable.expiresAt, new Date()),
  ));
  if (!reset) return void res.status(400).json({ error: "This reset link is invalid or has expired." });
  await db.transaction(async (tx) => {
    await tx.update(usersTable).set({ passwordHash: await hashPassword(password) }).where(eq(usersTable.id, reset.userId));
    await tx.update(passwordResetTokensTable).set({ usedAt: new Date() }).where(eq(passwordResetTokensTable.id, reset.id));
    await tx.update(sessionsTable).set({ revoked: true }).where(eq(sessionsTable.userId, reset.userId));
  });
  return res.json({ message: "Password updated. Log in again on each device." });
});

authRouter.post("/change-password", requireAuth, async (req, res) => {
  const currentPassword = String(req.body.currentPassword ?? "");
  const nextPassword = String(req.body.newPassword ?? "");
  const userId = (req as AuthRequest).userId;
  if (nextPassword.length < 10 || nextPassword.length > 128 || !/[a-zA-Z]/.test(nextPassword) || !/\d/.test(nextPassword)) return void res.status(400).json({ error: "Use a 10-128 character password containing a letter and number." });
  const [user] = await db.select({ passwordHash: usersTable.passwordHash }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user?.passwordHash || !(await verifyPassword(currentPassword, user.passwordHash))) return void res.status(401).json({ error: "Current password is incorrect." });
  await db.update(usersTable).set({ passwordHash: await hashPassword(nextPassword) }).where(eq(usersTable.id, userId));
  const cookieToken = req.cookies?.[COOKIE] as string | undefined;
  if (cookieToken) await db.update(sessionsTable).set({ revoked: true }).where(and(eq(sessionsTable.userId, userId), ne(sessionsTable.tokenHash, tokenHash(cookieToken))));
  return res.json({ message: "Password changed. Other sessions were signed out." });
});

authRouter.get("/sessions", requireAuth, async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const current = tokenHash(String(req.cookies?.[COOKIE] ?? ""));
  const rows = await db.select().from(sessionsTable).where(and(eq(sessionsTable.userId, userId), eq(sessionsTable.revoked, false), gt(sessionsTable.expiresAt, new Date()))).orderBy(desc(sessionsTable.lastSeenAt));
  return res.json(rows.map((session) => ({
    id: session.id,
    userAgent: session.userAgent,
    ipAddress: session.ipAddress ? session.ipAddress.replace(/(\d+)$/, "x") : null,
    lastSeenAt: session.lastSeenAt.toISOString(),
    createdAt: session.createdAt.toISOString(),
    current: session.tokenHash === current,
  })));
});

authRouter.delete("/sessions/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const userId = (req as AuthRequest).userId;
  const current = tokenHash(String(req.cookies?.[COOKIE] ?? ""));
  const [session] = await db.select().from(sessionsTable).where(and(eq(sessionsTable.id, id), eq(sessionsTable.userId, userId)));
  if (!session) return void res.status(204).send();
  if (session.tokenHash === current) return void res.status(400).json({ error: "Use Log out to end this session." });
  await db.update(sessionsTable).set({ revoked: true }).where(eq(sessionsTable.id, id));
  return res.status(204).send();
});

authRouter.post("/sessions/revoke-others", requireAuth, async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const current = tokenHash(String(req.cookies?.[COOKIE] ?? ""));
  await db.update(sessionsTable).set({ revoked: true }).where(and(eq(sessionsTable.userId, userId), ne(sessionsTable.tokenHash, current)));
  return res.status(204).send();
});
