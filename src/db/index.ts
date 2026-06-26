import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// Reuse the pool across hot reloads in dev to avoid exhausting connections.
const globalForDb = globalThis as unknown as { __pleinrPool?: Pool };

export const pool =
  globalForDb.__pleinrPool ??
  new Pool({
    connectionString,
    max: Number(process.env.PG_POOL_MAX ?? 10),
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__pleinrPool = pool;
}

export const db = drizzle(pool, { schema });
export { schema };
