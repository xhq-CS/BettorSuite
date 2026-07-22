import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// `pg` currently treats these legacy modes as verify-full and warns on stderr.
// Normalize the URL explicitly so Vercel does not report successful requests as
// runtime errors and the stronger certificate verification remains unchanged.
const connectionString = process.env.DATABASE_URL.replace(
  /([?&])sslmode=(prefer|require|verify-ca)(?=&|$)/i,
  "$1sslmode=verify-full",
);

export const pool = new Pool({
  connectionString,
  max: process.env.VERCEL ? 3 : 10,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
  allowExitOnIdle: true,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
