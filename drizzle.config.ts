import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });
config();

const rawConnectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL_UNPOOLED;

if (!rawConnectionString) {
  throw new Error(
    "No database connection string found. Set DATABASE_URL in .env.local before running drizzle-kit."
  );
}

const isLocal = /localhost|127\.0\.0\.1/.test(rawConnectionString);
const parsed = new URL(rawConnectionString);

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Using discrete fields (rather than `url`) because drizzle-kit's `pg` driver
  // silently ignores `ssl` whenever `dbCredentials.url` is set.
  dbCredentials: {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 5432,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ""),
    ssl: isLocal ? false : { rejectUnauthorized: false },
  },
});
