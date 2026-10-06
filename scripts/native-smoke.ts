import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
// Explicitly supplied isolated test database only. Never point this mutation check at real books.
if (!process.env.NATIVE_TEST_DATABASE_URL || !process.env.NATIVE_TEST_CA_FILE)
  throw new Error(
    "Configure the isolated native PostgreSQL test database and CA",
  );
process.env.APP_MODE = "live";
process.env.DATABASE_URL = process.env.NATIVE_TEST_DATABASE_URL;
process.env.DATABASE_CA_FILE = process.env.NATIVE_TEST_CA_FILE;
const { getDb, migrate } = await import("../src/lib/db");
const { executeOperation, parseOperation } =
  await import("../src/lib/operations");
const { operationalWorkspace } =
  await import("../src/lib/operational-workspace");
const db = await getDb();
await migrate(db);
await migrate(db);
const encrypted = await db.query<{ ssl: boolean }>(
  "SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()",
);
assert.equal(encrypted.rows[0].ssl, true);
assert.equal(
  (
    await db.query<{ n: number }>(
      "SELECT count(*)::int n FROM users WHERE is_demo=true",
    )
  ).rows[0].n,
  0,
);
const actor = "native-fixture-" + randomUUID();
await db.query(
  "INSERT INTO users(id,email,name,role,is_demo) VALUES($1,$2,'Native Test Owner','OWNER',false)",
  [actor, actor + "@company-os.local"],
);
const command = parseOperation(
  {
    action: "expense",
    storeId: "gia",
    entityId: "omurtak",
    currency: "USD",
    values: {
      vendor: "Native TEST fixture",
      category: "SaaS",
      amount: "12.34",
      recognizedDate: "2026-10-06",
      dueDate: "2026-10-07",
      recognition: "OPERATING",
      notes: "Fictional native PostgreSQL smoke",
    },
  },
  { role: "OWNER" },
);
const result = await db.transaction(async (tx) => {
  await tx.query("SELECT set_config('app.actor_id',$1,true)", [actor]);
  return executeOperation(tx, command, actor);
});
const records = await operationalWorkspace("gia", "USD", "omurtak", true);
assert.ok(records.tables.expenses.some((e) => e.id === result.id));
const before = (
  await db.query<{ n: number }>("SELECT count(*)::int n FROM expenses")
).rows[0].n;
await assert.rejects(
  db.transaction(async (tx) => {
    await executeOperation(tx, command, actor);
    throw new Error("Deliberate atomicity test");
  }),
);
assert.equal(
  (await db.query<{ n: number }>("SELECT count(*)::int n FROM expenses"))
    .rows[0].n,
  before,
);
assert.ok(
  (await db.query("SELECT id FROM audit_logs WHERE actor_id=$1", [actor])).rows
    .length > 0,
);
console.log(
  "PASS: native PostgreSQL 17, verified TLS, repeatable migrations, real pg driver dates, live-mode demo isolation, atomic operations and audit actor attribution.",
);
process.exit(0);
