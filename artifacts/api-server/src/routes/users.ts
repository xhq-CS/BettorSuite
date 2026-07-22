import { Router } from "express";
import { db } from "@workspace/db";
import {
  betsTable,
  dailyCardsTable,
  followsTable,
  publicBetRevisionsTable,
  usersTable,
} from "@workspace/db";
import { eq, and, desc, ilike, ne, or } from "drizzle-orm";
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
import { trackerBetSnapshot } from "../lib/betSnapshots";
import { getDailyCard } from "../lib/dailyCards";

export const usersRouter = Router();
const currentUserId = (req: unknown) => (req as AuthRequest).userId;

async function publicStats(userId: number) {
  const rows = await db.select().from(betsTable).where(eq(betsTable.userId, userId));
  const settled = rows.filter((bet) => ["won", "lost", "push"].includes(bet.status));
  const wins = settled.filter((bet) => bet.status === "won").length;
  const losses = settled.filter((bet) => bet.status === "lost").length;
  const pushes = settled.filter((bet) => bet.status === "push").length;
  const totalWagered = settled.reduce((sum, bet) => sum + Number(bet.wager), 0);
  const resultProfit = (bet: typeof betsTable.$inferSelect) => {
    if (bet.status === "won")
      return Number(bet.actualPayout ?? bet.potentialPayout) - Number(bet.wager);
    if (bet.status === "lost") return -Number(bet.wager);
    return 0;
  };
  const totalProfit = settled.reduce((sum, bet) => sum + resultProfit(bet), 0);
  const profitByDay = new Map<string, number>();
  settled.forEach((bet) => {
    const day = (bet.settledAt ?? bet.createdAt).toISOString().slice(0, 10);
    profitByDay.set(day, (profitByDay.get(day) ?? 0) + resultProfit(bet));
  });
  const weekStart = new Date();
  weekStart.setUTCHours(0, 0, 0, 0);
  const daysSinceMonday = (weekStart.getUTCDay() + 6) % 7;
  weekStart.setUTCDate(weekStart.getUTCDate() - daysSinceMonday);
  const streak = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart);
    day.setUTCDate(weekStart.getUTCDate() + index);
    const date = day.toISOString().slice(0, 10);
    const profit =
      Math.round(((profitByDay.get(date) ?? 0) + Number.EPSILON) * 100) / 100;
    return { date, profit, profitable: profit > 0 };
  });
  return {
    totalBets: rows.length,
    settledBets: settled.length,
    wins,
    losses,
    pushes,
    winRate: wins + losses > 0 ? wins / (wins + losses) : 0,
    roi: totalWagered > 0 ? totalProfit / totalWagered : 0,
    totalProfit,
    streak,
  };
}

async function formatUser(
  u: typeof usersTable.$inferSelect,
  viewerId: number,
  includeStats = false,
) {
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
    ...(includeStats ? { stats: await publicStats(u.id) } : {}),
    createdAt: u.createdAt.toISOString(),
  };
}

// GET /users
usersRouter.get("/", async (req, res) => {
  const query = ListUsersQueryParams.parse(req.query);
  const search = query.search?.trim();
  const rows = await db
    .select()
    .from(usersTable)
    .where(
      search
        ? and(
            ne(usersTable.id, currentUserId(req)),
            or(
              ilike(usersTable.username, `%${search}%`),
              ilike(usersTable.displayName, `%${search}%`),
            ),
          )
        : ne(usersTable.id, currentUserId(req)),
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
  return res.json(await formatUser(user, currentUserId(req), true));
});

// PATCH /users/me
usersRouter.patch("/me", async (req, res) => {
  const body = UpdateMeBody.parse(req.body);
  if (body.displayName !== undefined && body.displayName.trim().length > 50)
    return void res.status(400).json({ error: "Display name cannot exceed 50 characters" });
  if (body.bio !== undefined && body.bio.trim().length > 240)
    return void res.status(400).json({ error: "Bio cannot exceed 240 characters" });
  if (body.favoriteSport !== undefined && body.favoriteSport.trim().length > 40)
    return void res.status(400).json({ error: "Favorite sport cannot exceed 40 characters" });
  if (body.avatarUrl !== undefined) {
    const avatar = body.avatarUrl.trim();
    const validDataImage = /^data:image\/(jpeg|png|webp);base64,/i.test(avatar) && avatar.length <= 900_000;
    const validRemoteImage = /^https:\/\//i.test(avatar) && avatar.length <= 2048;
    if (avatar && !validDataImage && !validRemoteImage)
      return void res.status(400).json({ error: "Choose a JPG, PNG, or WebP profile image" });
  }
  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (body.displayName !== undefined) updates.displayName = body.displayName.trim() || null;
  if (body.bio !== undefined) updates.bio = body.bio.trim() || null;
  if (body.avatarUrl !== undefined) updates.avatarUrl = body.avatarUrl.trim() || null;
  if (body.favoriteSport !== undefined) updates.favoriteSport = body.favoriteSport.trim() || null;

  const [user] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, currentUserId(req)))
    .returning();

  if (!user) return void res.status(404).json({ error: "User not found" });
  return res.json(await formatUser(user, currentUserId(req), true));
});

// GET /users/:id/picks - active public tracker picks with edit history
usersRouter.get("/:id/picks", async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0)
    return void res.status(400).json({ error: "Invalid bettor" });
  const [current, revisions] = await Promise.all([
    db.select().from(betsTable).where(eq(betsTable.userId, userId)).orderBy(desc(betsTable.createdAt)),
    db.select().from(publicBetRevisionsTable).where(eq(publicBetRevisionsTable.userId, userId)).orderBy(desc(publicBetRevisionsTable.createdAt)),
  ]);
  const revisionsByBet = new Map<number, typeof revisions>();
  for (const revision of revisions) {
    const list = revisionsByBet.get(revision.sourceBetId) ?? [];
    list.push(revision);
    revisionsByBet.set(revision.sourceBetId, list);
  }
  const livePicks = current.map((bet) => ({
    id: `bet-${bet.id}`,
    sourceBetId: bet.id,
    edited: (revisionsByBet.get(bet.id) ?? []).some((item) => item.action === "edited"),
    updatedAt: bet.updatedAt.toISOString(),
    snapshot: trackerBetSnapshot(bet, bet.updatedAt),
    revisions: (revisionsByBet.get(bet.id) ?? [])
      .filter((item) => item.action === "edited")
      .map((item) => ({
        id: item.id,
        action: item.action,
        snapshot: item.snapshot,
        createdAt: item.createdAt.toISOString(),
      })),
  }));
  return res.json(livePicks.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
});

usersRouter.get("/:id/daily-cards", async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0)
    return void res.status(400).json({ error: "Invalid bettor" });
  const rows = await db
    .select({ id: dailyCardsTable.id })
    .from(dailyCardsTable)
    .where(eq(dailyCardsTable.userId, userId))
    .orderBy(desc(dailyCardsTable.createdAt))
    .limit(50);
  const cards = await Promise.all(rows.map((row) => getDailyCard(row.id)));
  return res.json(cards.filter(Boolean));
});

// GET /users/:id
usersRouter.get("/:id", async (req, res) => {
  const { id } = GetUserParams.parse({ id: Number(req.params.id) });
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, id));

  if (!user) return void res.status(404).json({ error: "User not found" });
  return res.json(await formatUser(user, currentUserId(req), true));
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
