import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
const { appMode, getDb } = await import("../src/lib/db");
const { storageCheck } = await import("../src/lib/storage");
try {
  if (appMode() !== "live") throw new Error("Set APP_MODE=live for this check");
  const origin = new URL(process.env.APP_ORIGIN || "");
  if (origin.protocol !== "https:" || origin.origin !== process.env.APP_ORIGIN)
    throw new Error("APP_ORIGIN must be an exact HTTPS origin");
  const db = await getDb();
  await db
    .query(
      "SELECT version FROM company_os.schema_migrations WHERE version=$1",
      ["009_expense_evidence"],
    )
    .then((result) => {
      if (!result.rows.length)
        throw new Error("Run db:migrate before checking readiness");
    });
  const result = await db.query<{ count: number }>(
    "SELECT count(*)::int AS count FROM users WHERE active=true AND is_demo=false AND role='OWNER'",
  );
  if (!result.rows[0].count)
    throw new Error("Create the initial owner with user:create");
  await storageCheck();
  console.log(
    "Live database, initial owner and private storage checks passed. Commerce integrations remain unconnected.",
  );
  process.exit(0);
} catch {
  console.error(
    "Live checks did not pass. Verify APP_MODE, HTTPS APP_ORIGIN, verified-TLS DATABASE_URL, migrations, initial owner, and private storage configuration. No credential values are logged.",
  );
  process.exit(1);
}
