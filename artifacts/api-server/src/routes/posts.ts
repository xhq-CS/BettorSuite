import { Router } from "express";
import { db } from "@workspace/db";
import {
  postsTable,
  postLikesTable,
  usersTable,
} from "@workspace/db";
import { eq, and, desc, sql, lt, inArray } from "drizzle-orm";
import {
  CreatePostBody,
  GetPostParams,
  DeletePostParams,
  LikePostParams,
  ListPostsQueryParams,
} from "@workspace/api-zod";

export const postsRouter = Router();
const DEFAULT_USER_ID = 1;

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
      createdAt: postsTable.createdAt,
    })
    .from(postsTable)
    .leftJoin(usersTable, eq(postsTable.userId, usersTable.id))
    .where(cursor ? lt(postsTable.id, Number(cursor)) as any : undefined)
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
              eq(postLikesTable.userId, DEFAULT_USER_ID)
            )
          )
      : [];

  const likeCountMap = new Map(likeCounts.map((l) => [l.postId, l.count]));
  const likedSet = new Set(userLikes.map((l) => l.postId));

  res.json({
    posts: items.map((p) => ({
      id: p.id,
      userId: p.userId,
      username: p.username ?? "Unknown",
      avatarUrl: p.avatarUrl ?? null,
      content: p.content,
      likeCount: likeCountMap.get(p.id) ?? 0,
      liked: likedSet.has(p.id),
      sport: p.sport ?? null,
      playerTag: p.playerTag ?? null,
      createdAt: p.createdAt.toISOString(),
    })),
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
      userId: DEFAULT_USER_ID,
      content: body.content,
      sport: body.sport ?? null,
      playerTag: body.playerTag ?? null,
    })
    .returning();

  const [user] = await db
    .select({ username: usersTable.username, avatarUrl: usersTable.avatarUrl })
    .from(usersTable)
    .where(eq(usersTable.id, DEFAULT_USER_ID));

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
    createdAt: post.createdAt.toISOString(),
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
      createdAt: postsTable.createdAt,
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
    .where(and(eq(postLikesTable.postId, id), eq(postLikesTable.userId, DEFAULT_USER_ID)));

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
    createdAt: post.createdAt.toISOString(),
  });
});

// DELETE /posts/:id
postsRouter.delete("/:id", async (req, res) => {
  const { id } = DeletePostParams.parse({ id: Number(req.params.id) });
  await db.delete(postLikesTable).where(eq(postLikesTable.postId, id));
  await db.delete(postsTable).where(and(eq(postsTable.id, id), eq(postsTable.userId, DEFAULT_USER_ID)));
  res.status(204).send();
});

// POST /posts/:id/like
postsRouter.post("/:id/like", async (req, res) => {
  const { id } = LikePostParams.parse({ id: Number(req.params.id) });
  const [existing] = await db
    .select()
    .from(postLikesTable)
    .where(and(eq(postLikesTable.postId, id), eq(postLikesTable.userId, DEFAULT_USER_ID)));

  if (existing) {
    await db.delete(postLikesTable).where(eq(postLikesTable.id, existing.id));
  } else {
    await db.insert(postLikesTable).values({ postId: id, userId: DEFAULT_USER_ID });
  }

  const [likeCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(postLikesTable)
    .where(eq(postLikesTable.postId, id));

  res.json({ liked: !existing, likeCount: likeCount?.count ?? 0 });
});
