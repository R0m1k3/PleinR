import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Lazily initialise the pool + drizzle client so that merely *importing* this
// module never requires DATABASE_URL. This matters during `next build`, which
// collects page data by importing server modules without runtime env set.
const globalForDb = globalThis as unknown as {
  __pleinrPool?: Pool;
  __pleinrDb?: NodePgDatabase<typeof schema>;
};

function getPool(): Pool {
  if (globalForDb.__pleinrPool) return globalForDb.__pleinrPool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const pool = new Pool({
    connectionString,
    max: Number(process.env.PG_POOL_MAX ?? 10),
  });
  globalForDb.__pleinrPool = pool;
  return pool;
}

function getDb(): NodePgDatabase<typeof schema> {
  if (globalForDb.__pleinrDb) return globalForDb.__pleinrDb;
  const instance = drizzle(getPool(), { schema });
  globalForDb.__pleinrDb = instance;
  return instance;
}

// Proxy that defers initialisation until the first property access (i.e. the
// first query at request time), so imports stay side-effect free.
export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    const instance = getDb();
    const value = Reflect.get(instance as object, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export function getPgPool(): Pool {
  return getPool();
}

export { schema };
