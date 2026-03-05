import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export interface DbOptions {
  connectionString?: string;
  max?: number;
}

export function createDb(options: DbOptions = {}) {
  const connectionString =
    options.connectionString ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL environment variable is required (or pass connectionString)",
    );
  }
  const client = postgres(connectionString, { max: options.max ?? 10 });
  const db = drizzle(client, { schema });
  return { db, client };
}

export type Db = ReturnType<typeof createDb>["db"];
