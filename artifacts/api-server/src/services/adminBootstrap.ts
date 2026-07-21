import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { hashPassword } from "../lib/passwords";
import type { Logger } from "pino";

export async function ensureAdminAccount(logger: Logger) {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const username = process.env.ADMIN_USERNAME?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email && !username && !password) return;
  if (!email || !username || !password || password.length < 14) {
    throw new Error("ADMIN_EMAIL, ADMIN_USERNAME, and an ADMIN_PASSWORD of at least 14 characters are all required to provision an admin.");
  }
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    if (existing.role !== "admin") await db.update(usersTable).set({ role: "admin" }).where(eq(usersTable.id, existing.id));
    logger.info({ userId: existing.id }, "Admin account is ready");
    return;
  }
  const [admin] = await db.insert(usersTable).values({ email, username, displayName: username, role: "admin", passwordHash: await hashPassword(password) }).returning();
  logger.info({ userId: admin.id }, "Admin account created");
}
