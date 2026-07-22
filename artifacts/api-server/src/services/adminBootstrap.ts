import { and, eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { hashPassword } from "../lib/passwords";
import type { Logger } from "pino";

export async function ensureAdminAccount(logger: Logger) {
  const officialUsername = "admin";
  const [legacyAdmin] = await db
    .select()
    .from(usersTable)
    .where(
      and(eq(usersTable.role, "admin"), eq(usersTable.username, "andy_admin")),
    );

  if (legacyAdmin) {
    const [usernameOwner] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.username, officialUsername));
    if (usernameOwner && usernameOwner.id !== legacyAdmin.id) {
      throw new Error(
        "The official admin username is already assigned to another account.",
      );
    }
    await db
      .update(usersTable)
      .set({ username: officialUsername, displayName: "Admin" })
      .where(eq(usersTable.id, legacyAdmin.id));
    logger.info({ userId: legacyAdmin.id }, "Official admin identity updated");
  }

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const configuredUsername = process.env.ADMIN_USERNAME?.trim().toLowerCase();
  const username =
    configuredUsername === "andy_admin" ? officialUsername : configuredUsername;
  const password = process.env.ADMIN_PASSWORD;
  if (!email && !username && !password) return;
  if (!email || !username || !password || password.length < 14) {
    throw new Error(
      "ADMIN_EMAIL, ADMIN_USERNAME, and an ADMIN_PASSWORD of at least 14 characters are all required to provision an admin.",
    );
  }
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));
  if (existing) {
    const [usernameOwner] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.username, username));
    if (usernameOwner && usernameOwner.id !== existing.id) {
      throw new Error(
        "The configured admin username is already assigned to another account.",
      );
    }
    await db
      .update(usersTable)
      .set({ role: "admin", username, displayName: "Admin" })
      .where(eq(usersTable.id, existing.id));
    logger.info({ userId: existing.id }, "Admin account is ready");
    return;
  }
  const [admin] = await db
    .insert(usersTable)
    .values({
      email,
      username,
      displayName: "Admin",
      role: "admin",
      passwordHash: await hashPassword(password),
    })
    .returning();
  logger.info({ userId: admin.id }, "Admin account created");
}
