import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

const sqlPath = process.argv[2];
if (!sqlPath) throw new Error("Usage: node apply-sql.mjs <migration.sql>");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query(await readFile(resolve(sqlPath), "utf8"));
  console.log(`Applied ${sqlPath}`);
} finally {
  await client.end();
}
