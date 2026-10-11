import { Pool, escapeIdentifier, escapeLiteral } from "pg";
import { createClient } from "@supabase/supabase-js";
import { readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { postgresConfig } from "../src/lib/postgres-config";
import { migrate, type Database } from "../src/lib/db";
import {
  setupTargets,
  ownerInput,
  ensureOwner,
  ensurePrivateBucket,
  postgresPasswordVerifier,
} from "../src/lib/live-provisioning";

let stage = "configuration";
let admin: Pool | undefined,
  runtime: Pool | undefined,
  caPath: string | undefined;
function database(pool: Pool): Database {
  return {
    exec: async (sql) => {
      await pool.query(sql);
    },
    query: async <T>(sql: string, params?: unknown[]) => ({
      rows: (await pool.query(sql, params)).rows as T[],
    }),
    transaction: async (fn) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await fn({
          exec: async (sql) => {
            await client.query(sql);
          },
          query: async <T>(sql: string, p?: unknown[]) => ({
            rows: (await client.query(sql, p)).rows as T[],
          }),
        });
        await client.query("COMMIT");
        return result;
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    },
  };
}
async function main() {
  if (
    process.env.APP_MODE !== "live" ||
    process.env.APP_ORIGIN !== "https://company-os-eight-iota.vercel.app" ||
    process.env.PRIVATE_STORAGE_PROVIDER !== "supabase"
  )
    throw new Error("Explicit live configuration required");
  for (const key of [
    "DATABASE_MIGRATION_URL",
    "DATABASE_URL",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "BOOTSTRAP_EMAIL",
    "BOOTSTRAP_NAME",
  ])
    if (!process.env[key]?.trim())
      throw new Error("Required configuration missing");
  const targets = setupTargets(
    process.env.DATABASE_MIGRATION_URL!,
    process.env.DATABASE_URL!,
    process.env.SUPABASE_URL!,
  );
  const owner = ownerInput(
    process.env.BOOTSTRAP_EMAIL,
    process.env.BOOTSTRAP_PASSWORD,
    process.env.BOOTSTRAP_NAME,
  );
  let ca: string | undefined;
  if (process.env.DATABASE_CA_CERT?.trim()) {
    ca = process.env.DATABASE_CA_CERT;
    caPath = path.join(
      process.env.RUNNER_TEMP || os.tmpdir(),
      "company-os-setup-ca-" + process.pid + ".pem",
    );
    await writeFile(caPath, ca, { mode: 0o600 });
    process.env.DATABASE_CA_FILE = caPath;
  }
  admin = new Pool(postgresConfig(process.env.DATABASE_MIGRATION_URL!, ca));
  const adminDb = database(admin);
  // Session lock also protects independently dispatched runs on the same database.
  const lock = await admin.connect();
  try {
    await lock.query("SELECT pg_advisory_lock(763182940)");
    stage = "existing-data preflight";
    const schema = (
      await admin.query("SELECT to_regclass('company_os.users') AS users")
    ).rows[0].users;
    if (
      schema &&
      (
        await admin.query(
          "SELECT 1 FROM company_os.users WHERE is_demo=true LIMIT 1",
        )
      ).rows.length
    )
      throw new Error(
        "Existing demo accounts require manual review; nothing is deleted",
      );
    stage = "migrations";
    await migrate(adminDb);
    console.log("PASS: existing migrations applied; no demo seed invoked.");
    stage = "runtime permissions";
    const role = (
      await admin.query(
        "SELECT rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolbypassrls FROM pg_roles WHERE rolname=$1",
        [targets.runtimeRole],
      )
    ).rows[0];
    if (
      role &&
      (!role.rolcanlogin ||
        role.rolsuper ||
        role.rolcreatedb ||
        role.rolcreaterole ||
        role.rolbypassrls)
    )
      throw new Error("Existing runtime role requires manual review");
    if (!role)
      await admin.query(
        "CREATE ROLE " +
          escapeIdentifier(targets.runtimeRole) +
          " LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD " +
          escapeLiteral(postgresPasswordVerifier(targets.runtimePassword)),
      );
    // Existing passwords are never reset.
    const group = (
      await admin.query(
        "SELECT rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolbypassrls FROM pg_roles WHERE rolname='company_os_runtime'",
      )
    ).rows[0];
    if (
      group &&
      (group.rolcanlogin ||
        group.rolsuper ||
        group.rolcreatedb ||
        group.rolcreaterole ||
        group.rolbypassrls)
    )
      throw new Error("Existing runtime group requires manual review");
    const ancestry = (
      await admin.query(
        "WITH RECURSIVE roles(id) AS (SELECT oid FROM pg_roles WHERE rolname=ANY($1::text[]) UNION SELECT m.roleid FROM pg_auth_members m JOIN roles r ON m.member=r.id) SELECT 1 FROM roles JOIN pg_roles p ON p.oid=roles.id WHERE NOT (p.rolname=ANY($1::text[])) LIMIT 1",
        [[targets.runtimeRole, "company_os_runtime"]],
      )
    ).rows;
    if (ancestry.length)
      throw new Error("Unexpected inherited role membership requires review");
    const ownedObjects = (
      await admin.query(
        "SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.oid=c.relowner WHERE n.nspname='company_os' AND r.rolname=ANY($1::text[]) LIMIT 1",
        [[targets.runtimeRole, "company_os_runtime"]],
      )
    ).rows;
    if (ownedObjects.length)
      throw new Error("Runtime roles must not own application objects");
    const owns = (
      await admin.query(
        "SELECT 1 FROM pg_namespace n JOIN pg_roles r ON r.oid=n.nspowner WHERE n.nspname='company_os' AND r.rolname=$1",
        [targets.runtimeRole],
      )
    ).rows;
    if (owns.length) throw new Error("Runtime login must not own the schema");
    await admin.query(await readFile("db/provision-runtime.sql", "utf8"));
    await admin.query(
      "GRANT company_os_runtime TO " + escapeIdentifier(targets.runtimeRole),
    );
    runtime = new Pool(postgresConfig(process.env.DATABASE_URL!, ca));
    const runtimeDb = database(runtime);
    const identityClient = await runtime.connect();
    try {
      const identity = (
        await identityClient.query("SELECT current_user AS name")
      ).rows[0];
      const socket = (
        identityClient as unknown as {
          connection: { stream: { encrypted?: boolean; authorized?: boolean } };
        }
      ).connection.stream;
      if (
        identity.name !== targets.runtimeRole ||
        socket.encrypted !== true ||
        socket.authorized !== true
      )
        throw new Error("Runtime identity/TLS check failed");
    } finally {
      identityClient.release();
    }
    if (
      (
        await runtime.query(
          "SELECT has_schema_privilege(current_user,'company_os','CREATE') AS allowed",
        )
      ).rows[0].allowed
    )
      throw new Error("Runtime has schema creation privileges");
    for (const table of ["schema_migrations", "audit_logs"]) {
      const privileges = (
        await runtime.query(
          "SELECT has_table_privilege(current_user,$1,'UPDATE') AS update,has_table_privilege(current_user,$1,'DELETE') AS delete",
          ["company_os." + table],
        )
      ).rows[0];
      if (privileges.update || privileges.delete)
        throw new Error("Runtime has excessive privileges");
    }
    console.log(
      "PASS: dedicated runtime login and restricted grants verified over TLS.",
    );
    stage = "private bucket";
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
          fetch: (input, init) =>
            fetch(input, {
              ...init,
              redirect: "error",
              signal: AbortSignal.timeout(15000),
            }),
        },
      },
    );
    await ensurePrivateBucket(
      supabase.storage,
      process.env.SUPABASE_STORAGE_BUCKET || "company-os-invoices",
    );
    console.log("PASS: private bucket and upload restrictions verified.");
    stage = "owner";
    const status = await ensureOwner(runtimeDb, owner);
    console.log(
      "PASS: owner " +
        status.toLowerCase() +
        "; existing credentials preserved.",
    );
    stage = "live:check";
    // Do not pass deployment-only DB credentials or bootstrap secrets to this child.
    const childEnv = { ...process.env };
    delete childEnv.DATABASE_MIGRATION_URL;
    delete childEnv.DATABASE_CA_CERT;
    for (const key of Object.keys(childEnv))
      if (key.startsWith("BOOTSTRAP_")) delete childEnv[key];
    const code = await new Promise<number>((resolve) => {
      const child = spawn(
        process.execPath,
        ["--import", "tsx", "scripts/live-check.ts"],
        { env: childEnv, stdio: ["ignore", "ignore", "ignore"] },
      );
      child.once("error", () => resolve(1));
      child.once("exit", (c) => resolve(c ?? 1));
    });
    if (code !== 0) throw new Error("Readiness check failed");
    console.log("PASS: live:check completed using runtime credentials.");
  } finally {
    await lock.query("SELECT pg_advisory_unlock(763182940)").catch(() => {});
    lock.release();
  }
}
try {
  await main();
} catch {
  console.error(
    "Live setup failed at " +
      stage +
      ". Credential values and provider errors are withheld. Review that stage's configuration and permissions; completed migrations are retained.",
  );
  process.exitCode = 1;
} finally {
  await runtime?.end().catch(() => {});
  await admin?.end().catch(() => {});
  if (caPath) await rm(caPath, { force: true });
}
