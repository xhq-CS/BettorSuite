import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, followsTable } from "@workspace/db";
import { eq, and, ilike, ne } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  GetUserParams,
  UpdateMeBody,
  FollowUserParams,
  UnfollowUserParams,
  GetUserFollowersParams,
  GetUserFollowingParams,
  ListUsersQueryParams,
} from "@workspace/api-zod";
import type { AuthRequest } from "../middleware/auth";

export const usersRouter = Router();
const currentUserId = (req: unknown) => (req as AuthRequest).userId;

async function formatUser(u: typeof usersTable.$inferSelect, viewerId: number) {
  const [{ count: followersCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(followsTable)
    .where(eq(followsTable.followingId, u.id));

  const [{ count: followingCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(followsTable)
    .where(eq(followsTable.followerId, u.id));

  let isFollowing = false;
  if (viewerId !== u.id) {
    const [follow] = await db
      .select()
      .from(followsTable)
      .where(and(eq(followsTable.followerId, viewerId), eq(followsTable.followingId, u.id)));
    isFollowing = !!follow;
  }

  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName ?? null,
    bio: u.bio ?? null,
    avatarUrl: u.avatarUrl ?? null,
    favoriteSport: u.favoriteSport ?? null,
    followersCount: followersCount ?? 0,
    followingCount: followingCount ?? 0,
    isFollowing,
    createdAt: u.createdAt.toISOString(),
  };
}

// GET /users
usersRouter.get("/", async (req, res) => {
  const query = ListUsersQueryParams.parse(req.query);
  const rows = await db
    .select()
    .from(usersTable)
    .where(
      query.search
        ? ilike(usersTable.username, `%${query.search}%`)
        : ne(usersTable.id, currentUserId(req))
    )
    .limit(30);

  const formatted = await Promise.all(rows.map((u) => formatUser(u, currentUserId(req))));
  res.json(formatted);
});

// GET /users/me
usersRouter.get("/me", async (req, res) => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, currentUserId(req)));

  if (!user) return void res.status(404).json({ error: "User not found" });
  return res.json(await formatUser(user, currentUserId(req)));
});

// PATCH /users/me
usersRouter.patch("/me", async (req, res) => {
  const body = UpdateMeBody.parse(req.body);
  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (body.displayName !== undefined) updates.displayName = body.displayName;
  if (body.bio !== undefined) updates.bio = body.bio;
  if (body.avatarUrl !== undefined) updates.avatarUrl = body.avatarUrl;
  if (body.favoriteSport !== undefined) updates.favoriteSport = body.favoriteSport;

  const [user] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, currentUserId(req)))
    .returning();

  if (!user) return void res.status(404).json({ error: "User not found" });
  return res.json(await formatUser(user, currentUserId(req)));
});

// GET /users/:id
usersRouter.get("/:id", async (req, res) => {
  const { id } = GetUserParams.parse({ id: Number(req.params.id) });
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, id));

  if (!user) return void res.status(404).json({ error: "User not found" });
  return res.json(await formatUser(user, currentUserId(req)));
});

// POST /users/:id/follow
usersRouter.post("/:id/follow", async (req, res) => {
  const { id } = FollowUserParams.parse({ id: Number(req.params.id) });
  if (id === currentUserId(req)) return void res.status(400).json({ error: "Cannot follow yourself" });

  const [existing] = await db
    .select()
    .from(followsTable)
    .where(and(eq(followsTable.followerId, currentUserId(req)), eq(followsTable.followingId, id)));

  if (!existing) {
    await db.insert(followsTable).values({ followerId: currentUserId(req), followingId: id });
  }

  return res.json({ following: true });
});

// DELETE /users/:id/follow
usersRouter.delete("/:id/follow", async (req, res) => {
  const { id } = UnfollowUserParams.parse({ id: Number(req.params.id) });
  await db
    .delete(followsTable)
    .where(and(eq(followsTable.followerId, currentUserId(req)), eq(followsTable.followingId, id)));
  res.status(204).send();
});

// GET /users/:id/followers
usersRouter.get("/:id/followers", async (req, res) => {
  const { id } = GetUserFollowersParams.parse({ id: Number(req.params.id) });
  const followers = await db
    .select({ userId: followsTable.followerId })
    .from(followsTable)
    .where(eq(followsTable.followingId, id));

  const users = await Promise.all(
    followers.map(async (f) => {
      const [u] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, f.userId));
      return u ? formatUser(u, currentUserId(req)) : null;
    })
  );

  res.json(users.filter(Boolean));
});

// GET /users/:id/following
usersRouter.get("/:id/following", async (req, res) => {
  const { id } = GetUserFollowingParams.parse({ id: Number(req.params.id) });
  const following = await db
    .select({ userId: followsTable.followingId })
    .from(followsTable)
    .where(eq(followsTable.followerId, id));

  const users = await Promise.all(
    following.map(async (f) => {
      const [u] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, f.userId));
      return u ? formatUser(u, currentUserId(req)) : null;
    })
  );

  res.json(users.filter(Boolean));
});
