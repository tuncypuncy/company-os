import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
const { appMode, getDb, actorTransaction } = await import("../src/lib/db");
const { executeOperation, parseOperation } =
  await import("../src/lib/operations");
if (appMode() !== "live")
  throw new Error(
    "Scheduled operations require live mode; demo generation is available in the workspace",
  );
const db = await getDb();
const owner = (
  await db.query<{ id: string }>(
    "SELECT id FROM users WHERE active AND NOT is_demo AND role='OWNER' ORDER BY created_at LIMIT 1",
  )
).rows[0];
if (!owner)
  throw new Error("Provision an active owner before scheduling operations");
const contexts = (
  await db.query<{
    store_id: string;
    legal_entity_id: string;
    currency: string;
  }>(
    "SELECT DISTINCT store_id,legal_entity_id,currency FROM recurring_expenses WHERE active",
  )
).rows;
const through = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
let generated = 0;
for (const context of contexts) {
  const command = parseOperation(
    {
      action: "recurring-generate",
      storeId: context.store_id,
      entityId: context.legal_entity_id,
      currency: context.currency,
      values: { through },
    },
    { role: "OWNER" },
  );
  const result = await actorTransaction(owner.id, (tx) =>
    executeOperation(tx, command, owner.id),
  );
  generated += "generated" in result ? Number(result.generated) : 0;
}
console.log(
  `${generated} recurring occurrences processed through ${through}; no payments initiated.`,
);
process.exit(0);
