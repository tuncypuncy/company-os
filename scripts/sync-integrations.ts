import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
const { appMode, getDb } = await import("../src/lib/db");
const { syncConnection } = await import("../src/lib/integrations/service");
if (appMode() !== "live")
  throw new Error("The integration worker runs only in live mode");
const db = await getDb();
const owner = (
  await db.query<{ id: string }>(
    "SELECT id FROM users WHERE active=true AND is_demo=false AND role='OWNER' ORDER BY created_at LIMIT 1",
  )
).rows[0];
if (!owner) throw new Error("Provision an owner before running ingestion");
const records = (
  await db.query<{ id: string }>(
    "SELECT id FROM integration_connections WHERE status IN ('CONNECTED','ACCESS_VERIFIED','ERROR')",
  )
).rows;
let failed = 0;
for (const c of records) {
  try {
    await syncConnection(c.id, owner.id, "sync");
    console.log("Connection ingestion complete.");
  } catch {
    failed++;
    console.error(
      "Connection ingestion failed. Review the private connection status page.",
    );
  }
}
process.exit(failed ? 1 : 0);
