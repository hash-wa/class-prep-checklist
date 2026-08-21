import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

function getConnectionString(): string {
  const url =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED;
  if (!url) {
    throw new Error(
      "No database connection string found. Set DATABASE_URL (or POSTGRES_URL) in your environment."
    );
  }
  // We set `ssl` explicitly below, so strip sslmode to avoid pg-connection-string's
  // deprecation warning about its sslmode alias handling.
  return url.replace(/([?&])sslmode=[^&]*&?/, "$1").replace(/[?&]$/, "");
}

const connectionString = getConnectionString();

const pool = new Pool({
  connectionString,
  ssl: /localhost|127\.0\.0\.1/.test(connectionString)
    ? false
    : { rejectUnauthorized: false },
});

export const db = drizzle(pool, { schema });
