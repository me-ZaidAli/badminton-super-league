import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// Pool is created lazily so the module can be imported during Next.js build
// without DATABASE_URL set. The real connection is only needed at request time.
function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set in bsl-hub/.env.local");
  }
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.DATABASE_SSL === "true"
        ? { rejectUnauthorized: false }
        : false,
  });
}

let _pool: pg.Pool | null = null;
export function getDbPool(): pg.Pool {
  if (!_pool) _pool = getPool();
  return _pool;
}

// Lazy drizzle instance — proxy that initialises on first property access
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    return drizzle(getDbPool(), { schema })[
      prop as keyof ReturnType<typeof drizzle<typeof schema>>
    ];
  },
});
