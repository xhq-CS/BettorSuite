import type { IncomingMessage, ServerResponse } from "node:http";
import app from "../artifacts/api-server/src/app";
import { logger } from "../artifacts/api-server/src/lib/logger";
import { ensureAdminAccount } from "../artifacts/api-server/src/services/adminBootstrap";

let initialization: Promise<void> | undefined;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  initialization ??= ensureAdminAccount(logger).catch((error) => {
    initialization = undefined;
    throw error;
  });
  await initialization;
  return app(req as any, res as any);
}
