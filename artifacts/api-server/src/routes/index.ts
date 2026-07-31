import { Router } from "express";
import healthRouter from "./health";
import { betsRouter } from "./bets";
import { simulatorRouter } from "./simulator";
import { postsRouter } from "./posts";
import { leaderboardRouter } from "./leaderboard";
import { usersRouter } from "./users";
import { groupsRouter } from "./groups";
import { authRouter } from "./auth";
import { sharesRouter } from "./shares";
import { conversationsRouter } from "./conversations";
import { dailyCardsRouter } from "./dailyCards";
import { requireAuth } from "../middleware/auth";
import { requireAdmin } from "../middleware/auth";
import { adminRouter } from "./admin";
import { presenceRouter } from "./presence";

const router = Router();

router.use("/", healthRouter);
router.use("/auth", authRouter);
router.use(requireAuth);
router.use("/admin", requireAdmin, adminRouter);
router.use("/presence", presenceRouter);
router.use("/bets", betsRouter);
router.use("/simulator", simulatorRouter);
router.use("/posts", postsRouter);
router.use("/leaderboard", leaderboardRouter);
router.use("/users", usersRouter);
router.use("/groups", groupsRouter);
router.use("/shares", sharesRouter);
router.use("/conversations", conversationsRouter);
router.use("/daily-cards", dailyCardsRouter);

export default router;
