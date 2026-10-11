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

import {
  configurationResults,
  connectWithDiagnostics,
  safeErrorCodes,
  requireVerifiedTls,
  SetupError,
} from "../src/lib/setup-diagnostics";

let stage = "configuration";
function enter(next: string) {
  stage = next;
  console.log("STAGE: " + stage);
}
function report(error: unknown, phase = stage) {
  console.error(
    "FAIL: stage=" + phase + " codes=" + safeErrorCodes(error).join(","),
  );
}
async function connect(pool: Pool, kind: string) {
  return connectWithDiagnostics(
    () => pool.connect(),
    () => enter(kind + " TLS handshake"),
  );
}
function observe(pool: Pool, kind: string) {
  pool.on("error", (error) => {
    report(error, kind + " idle connection");
    process.exitCode = 1;
  });
}
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
        await client.query("ROLLBACK").catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    },
  };
}
async function main() {
  const validation = configurationResults(process.env);
  for (const result of validation)
    console.log(
      "CONFIG: " +
        result.setting +
        " check=" +
        result.check +
        " result=" +
        result.result,
    );
  if (validation.some((result) => result.result === "FAIL"))
    throw new SetupError("CONFIG_INVALID");
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
  enter("admin connection");
  admin = new Pool(postgresConfig(process.env.DATABASE_MIGRATION_URL!, ca));
  observe(admin, "admin");
  const adminDb = database(admin);
  // Session lock also protects independently dispatched runs on the same database.
  const lock = await connect(admin, "admin");
  try {
    console.log("PASS: admin connection established.");
    enter("admin TLS");
    requireVerifiedTls(
      (
        lock as unknown as {
          connection: { stream: { encrypted?: boolean; authorized?: boolean } };
        }
      ).connection.stream,
    );
    console.log("PASS: admin TLS encryption and certificate verification.");
    enter("setup lock");
    await lock.query("SELECT pg_advisory_lock(763182940)");
    enter("existing-data preflight");
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
    enter("migrations");
    await migrate(adminDb);
    console.log("PASS: existing migrations applied; no demo seed invoked.");
    enter("runtime permissions");
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
    enter("runtime connection");
    runtime = new Pool(postgresConfig(process.env.DATABASE_URL!, ca));
    observe(runtime, "runtime");
    const runtimeDb = database(runtime);
    const identityClient = await connect(runtime, "runtime");
    try {
      console.log("PASS: runtime connection established.");
      enter("runtime TLS");
      const socket = (
        identityClient as unknown as {
          connection: { stream: { encrypted?: boolean; authorized?: boolean } };
        }
      ).connection.stream;
      requireVerifiedTls(socket);
      console.log("PASS: runtime TLS encryption and certificate verification.");
      enter("runtime identity");
      const identity = (
        await identityClient.query("SELECT current_user AS name")
      ).rows[0];

      if (identity.name !== targets.runtimeRole)
        throw new SetupError("RUNTIME_IDENTITY_MISMATCH");
    } finally {
      identityClient.release();
    }
    enter("runtime permission verification");
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
    enter("private bucket");
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
    enter("owner");
    const status = await ensureOwner(runtimeDb, owner);
    console.log(
      "PASS: owner " +
        status.toLowerCase() +
        "; existing credentials preserved.",
    );
    enter("live:check");
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
    if (code !== 0) throw new SetupError("READINESS_CHECK_FAILED");
    console.log("PASS: live:check completed using runtime credentials.");
  } finally {
    await lock.query("SELECT pg_advisory_unlock(763182940)").catch(() => {});
    lock.release();
  }
}
try {
  await main();
} catch (error) {
  report(error);
  console.error(
    "Completed migrations are retained; raw errors and connection addresses are withheld.",
  );
  process.exitCode = 1;
} finally {
  await runtime?.end().catch(() => {});
  await admin?.end().catch(() => {});
  if (caPath)
    await rm(caPath, { force: true }).catch((error) => {
      report(error, "temporary CA cleanup");
      process.exitCode = 1;
    });
}
