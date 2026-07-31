import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://authlab:authlab@localhost:5433/authlab";

const globalForDatabase = globalThis as unknown as {
  sqlClient?: ReturnType<typeof postgres>;
};

const sqlClient =
  globalForDatabase.sqlClient ??
  postgres(databaseUrl, {
    max: process.env.NODE_ENV === "production" ? 10 : 4,
    prepare: false
  });

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.sqlClient = sqlClient;
}

export const db = drizzle(sqlClient, { schema });
export { sqlClient };
