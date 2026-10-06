import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";
import { postgresConfig } from "./postgres-config";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { seedDemoOperations } from "./demo-operations";
import { seedDemo } from "./seed";
export type QueryResult<T> = { rows: T[] };
export interface Sql {
  exec(sql: string): Promise<void>;
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;
}
export interface Database extends Sql {
  transaction<T>(fn: (tx: Sql) => Promise<T>): Promise<T>;
}
export function appMode() {
  const mode = process.env.APP_MODE ?? "demo";
  if (!["demo", "live"].includes(mode))
    throw new Error("APP_MODE must be demo or live");
  return mode as "demo" | "live";
}
declare global {
  var companyOsDatabase: Promise<Database> | undefined;
}
export async function migrate(db: Database) {
  await db.exec(
    "CREATE SCHEMA IF NOT EXISTS company_os; SET search_path TO company_os, public",
  );
  await db.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  for (const version of [
    "001_foundation",
    "002_organization",
    "003_private_storage",
    "004_operations",
    "005_inventory",
    "006_reporting",
    "007_integrity",
    "008_settlement",
    "009_expense_evidence",
  ]) {
    await db.transaction(async (tx) => {
      await tx.exec("LOCK TABLE schema_migrations IN EXCLUSIVE MODE");
      const exists = await tx.query(
        "SELECT version FROM schema_migrations WHERE version=$1",
        [version],
      );
      if (exists.rows.length) return;
      await tx.exec(
        await readFile(
          path.join(process.cwd(), `db/migrations/${version}.sql`),
          "utf8",
        ),
      );
      await tx.query("INSERT INTO schema_migrations(version) VALUES($1)", [
        version,
      ]);
    });
  }
}
async function connect(): Promise<Database> {
  if (appMode() === "demo") {
    const dir = path.resolve(process.env.DEMO_DATA_DIR || ".data/demo");
    await mkdir(dir, { recursive: true });
    const engine = new PGlite(dir);
    const db: Database = {
      exec: async (sql) => {
        await engine.exec(sql);
      },
      query: (sql, params) => engine.query(sql, params),
      transaction: (fn) =>
        engine.transaction((tx) =>
          fn({
            exec: async (sql) => {
              await tx.exec(sql);
            },
            query: (sql, params) => tx.query(sql, params),
          }),
        ),
    };
    await migrate(db);
    await seedDemo(db);
    await seedDemoOperations(db);
    return db;
  }
  if (!process.env.DATABASE_URL)
    throw new Error(
      "Live mode requires DATABASE_URL; demo credentials are never used in live mode.",
    );
  const ca = process.env.DATABASE_CA_FILE
    ? await readFile(process.env.DATABASE_CA_FILE, "utf8")
    : undefined;
  const pool = new Pool(postgresConfig(process.env.DATABASE_URL, ca));
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
          query: async <T>(sql: string, params?: unknown[]) => ({
            rows: (await client.query(sql, params)).rows as T[],
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
export function getDb() {
  return (global.companyOsDatabase ??= connect().catch((error) => {
    global.companyOsDatabase = undefined;
    throw error;
  }));
}
export async function actorTransaction<T>(
  actor: string,
  fn: (tx: Sql) => Promise<T>,
) {
  return (await getDb()).transaction(async (tx) => {
    await tx.query("SELECT set_config('app.actor_id',$1,true)", [actor]);
    return fn(tx);
  });
}
