import { Router } from "express";
import healthRouter from "./health";
import { playersRouter } from "./players";
import { teamsRouter } from "./teams";
import { betsRouter } from "./bets";
import { simulatorRouter } from "./simulator";
import { postsRouter } from "./posts";
import { leaderboardRouter } from "./leaderboard";
import { usersRouter } from "./users";
import { trendingRouter } from "./trending";
import { groupsRouter } from "./groups";
import { livestatsRouter } from "./livestats";
import { authRouter } from "./auth";
import { sharesRouter } from "./shares";
import { conversationsRouter } from "./conversations";
import { dailyCardsRouter } from "./dailyCards";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.use("/", healthRouter);
router.use("/auth", authRouter);
router.use(requireAuth);
router.use("/players", playersRouter);
router.use("/teams", teamsRouter);
router.use("/bets", betsRouter);
router.use("/simulator", simulatorRouter);
router.use("/posts", postsRouter);
router.use("/leaderboard", leaderboardRouter);
router.use("/stats", trendingRouter);
router.use("/users", usersRouter);
router.use("/groups", groupsRouter);
router.use("/shares", sharesRouter);
router.use("/conversations", conversationsRouter);
router.use("/daily-cards", dailyCardsRouter);
router.use("/livestats", livestatsRouter);

export default router;
