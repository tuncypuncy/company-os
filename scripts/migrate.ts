import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
const { getDb, migrate } = await import("../src/lib/db");
await migrate(await getDb());
console.log("Database migration complete.");
process.exit(0);
