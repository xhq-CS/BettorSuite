import app from "./app";
import { logger } from "./lib/logger";
import { scheduleDailySync, runStartupSyncIfNeeded } from "./services/dailySync";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Schedule the 5am daily sync (arms a setTimeout, non-blocking)
  scheduleDailySync(logger);

  // If no sync has run today yet, kick one off in the background
  // (don't await — let the server finish starting up first)
  setImmediate(() => runStartupSyncIfNeeded(logger));
});
