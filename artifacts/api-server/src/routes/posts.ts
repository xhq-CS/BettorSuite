import { Router } from "express";
import { db } from "@workspace/db";
import { postsTable, postLikesTable, usersTable } from "@workspace/db";
import { eq, and, desc, sql, lt, inArray } from "drizzle-orm";
import {
  CreatePostBody,
  GetPostParams,
  DeletePostParams,
  LikePostParams,
  ListPostsQueryParams,
} from "@workspace/api-zod";
import type { AuthRequest } from "../middleware/auth";
import { getDailyCard } from "../lib/dailyCards";

export const postsRouter = Router();
const currentUserId = (req: unknown) => (req as AuthRequest).userId;

// GET /posts
postsRouter.get("/", async (req, res) => {
  const query = ListPostsQueryParams.parse(req.query);
  const limit = query.limit ?? 20;
  const cursor = query.cursor;

  const posts = await db
    .select({
      id: postsTable.id,
      userId: postsTable.userId,
      username: usersTable.username,
      avatarUrl: usersTable.avatarUrl,
      content: postsTable.content,
      sport: postsTable.sport,
      playerTag: postsTable.playerTag,
      betShare: postsTable.betShare,
      dailyCardId: postsTable.dailyCardId,
      createdAt: postsTable.createdAt,
      editedAt: postsTable.editedAt,
    })
    .from(postsTable)
    .leftJoin(usersTable, eq(postsTable.userId, usersTable.id))
    .where(cursor ? (lt(postsTable.id, Number(cursor)) as any) : undefined)
    .orderBy(desc(postsTable.createdAt))
    .limit(limit + 1);

  const hasMore = posts.length > limit;
  const items = hasMore ? posts.slice(0, limit) : posts;
  const postIds = items.map((p) => p.id);

  const likeCounts =
    postIds.length > 0
      ? await db
          .select({
            postId: postLikesTable.postId,
            count: sql<number>`count(*)::int`,
          })
          .from(postLikesTable)
          .where(inArray(postLikesTable.postId, postIds))
          .groupBy(postLikesTable.postId)
      : [];

  const userLikes =
    postIds.length > 0
      ? await db
          .select({ postId: postLikesTable.postId })
          .from(postLikesTable)
          .where(
            and(
              inArray(postLikesTable.postId, postIds),
              eq(postLikesTable.userId, currentUserId(req)),
            ),
          )
      : [];

  const likeCountMap = new Map(likeCounts.map((l) => [l.postId, l.count]));
  const likedSet = new Set(userLikes.map((l) => l.postId));

  res.json({
    posts: await Promise.all(items.map(async (p) => ({
      id: p.id,
      userId: p.userId,
      username: p.username ?? "Unknown",
      avatarUrl: p.avatarUrl ?? null,
      content: p.content,
      likeCount: likeCountMap.get(p.id) ?? 0,
      liked: likedSet.has(p.id),
      sport: p.sport ?? null,
      playerTag: p.playerTag ?? null,
      betShare: p.betShare ?? null,
      dailyCard: await getDailyCard(p.dailyCardId),
      createdAt: p.createdAt.toISOString(),
      editedAt: p.editedAt?.toISOString() ?? null,
    }))),
    hasMore,
    nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
  });
});

// POST /posts
postsRouter.post("/", async (req, res) => {
  const body = CreatePostBody.parse(req.body);
  const [post] = await db
    .insert(postsTable)
    .values({
      userId: currentUserId(req),
      content: body.content,
      sport: body.sport ?? null,
      playerTag: body.playerTag ?? null,
    })
    .returning();

  const [user] = await db
    .select({ username: usersTable.username, avatarUrl: usersTable.avatarUrl })
    .from(usersTable)
    .where(eq(usersTable.id, currentUserId(req)));

  res.status(201).json({
    id: post.id,
    userId: post.userId,
    username: user?.username ?? "Unknown",
    avatarUrl: user?.avatarUrl ?? null,
    content: post.content,
    likeCount: 0,
    liked: false,
    sport: post.sport,
    playerTag: post.playerTag,
    betShare: post.betShare ?? null,
    dailyCard: null,
    createdAt: post.createdAt.toISOString(),
    editedAt: post.editedAt?.toISOString() ?? null,
  });
});

// GET /posts/:id
postsRouter.get("/:id", async (req, res) => {
  const { id } = GetPostParams.parse({ id: Number(req.params.id) });
  const [post] = await db
    .select({
      id: postsTable.id,
      userId: postsTable.userId,
      username: usersTable.username,
      avatarUrl: usersTable.avatarUrl,
      content: postsTable.content,
      sport: postsTable.sport,
      playerTag: postsTable.playerTag,
      betShare: postsTable.betShare,
      dailyCardId: postsTable.dailyCardId,
      createdAt: postsTable.createdAt,
      editedAt: postsTable.editedAt,
    })
    .from(postsTable)
    .leftJoin(usersTable, eq(postsTable.userId, usersTable.id))
    .where(eq(postsTable.id, id));

  if (!post) return void res.status(404).json({ error: "Post not found" });

  const [likeCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(postLikesTable)
    .where(eq(postLikesTable.postId, id));

  const [userLike] = await db
    .select()
    .from(postLikesTable)
    .where(
      and(
        eq(postLikesTable.postId, id),
        eq(postLikesTable.userId, currentUserId(req)),
      ),
    );

  res.json({
    id: post.id,
    userId: post.userId,
    username: post.username ?? "Unknown",
    avatarUrl: post.avatarUrl ?? null,
    content: post.content,
    likeCount: likeCount?.count ?? 0,
    liked: !!userLike,
    sport: post.sport,
    playerTag: post.playerTag,
    betShare: post.betShare ?? null,
    dailyCard: await getDailyCard(post.dailyCardId),
    createdAt: post.createdAt.toISOString(),
    editedAt: post.editedAt?.toISOString() ?? null,
  });
});

// PATCH /posts/:id - authors can edit only their own War Room messages
postsRouter.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const content = String(req.body.content ?? "").trim();
  if (!Number.isInteger(id) || id <= 0)
    return void res.status(400).json({ error: "Invalid post" });
  if (!content || content.length > 2000) {
    return void res
      .status(400)
      .json({ error: "Message must be 1-2000 characters" });
  }

  const [existing] = await db
    .select({ userId: postsTable.userId })
    .from(postsTable)
    .where(eq(postsTable.id, id));
  if (!existing) return void res.status(404).json({ error: "Post not found" });
  if (existing.userId !== currentUserId(req))
    return void res
      .status(403)
      .json({ error: "You can only edit your own message" });

  const [post] = await db
    .update(postsTable)
    .set({ content, editedAt: new Date() })
    .where(eq(postsTable.id, id))
    .returning();
  return res.json({
    ...post,
    createdAt: post.createdAt.toISOString(),
    editedAt: post.editedAt?.toISOString() ?? null,
  });
});

// DELETE /posts/:id
postsRouter.delete("/:id", async (req, res) => {
  const { id } = DeletePostParams.parse({ id: Number(req.params.id) });
  const [existing] = await db
    .select({ userId: postsTable.userId })
    .from(postsTable)
    .where(eq(postsTable.id, id));
  if (!existing) return void res.status(404).json({ error: "Post not found" });
  if (existing.userId !== currentUserId(req))
    return void res
      .status(403)
      .json({ error: "You can only delete your own message" });
  await db.delete(postLikesTable).where(eq(postLikesTable.postId, id));
  await db.delete(postsTable).where(eq(postsTable.id, id));
  res.status(204).send();
});

// POST /posts/:id/like
postsRouter.post("/:id/like", async (req, res) => {
  const { id } = LikePostParams.parse({ id: Number(req.params.id) });
  const [existing] = await db
    .select()
    .from(postLikesTable)
    .where(
      and(
        eq(postLikesTable.postId, id),
        eq(postLikesTable.userId, currentUserId(req)),
      ),
    );

  if (existing) {
    await db.delete(postLikesTable).where(eq(postLikesTable.id, existing.id));
  } else {
    await db
      .insert(postLikesTable)
      .values({ postId: id, userId: currentUserId(req) });
  }

  const [likeCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(postLikesTable)
    .where(eq(postLikesTable.postId, id));

  res.json({ liked: !existing, likeCount: likeCount?.count ?? 0 });
});
