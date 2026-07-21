import type { IncomingMessage, ServerResponse } from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { ensureAdminAccount } from "./services/adminBootstrap";

let initialization: Promise<void> | undefined;

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  initialization ??= ensureAdminAccount(logger).catch((error) => {
    initialization = undefined;
    throw error;
  });
  await initialization;
  return app(req as any, res as any);
}
