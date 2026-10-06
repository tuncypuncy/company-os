import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
if (process.env.DATABASE_MIGRATION_URL)
  process.env.DATABASE_URL = process.env.DATABASE_MIGRATION_URL;
const { getDb, migrate } = await import("../src/lib/db");
await migrate(await getDb());
console.log("Database migration complete.");
process.exit(0);
