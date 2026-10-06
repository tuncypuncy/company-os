// Generates isolated test data only. Never run this against a live database.
import nextEnv from "@next/env";
import { randomBytes, createHash, scryptSync } from "node:crypto";
import { writeFile } from "node:fs/promises";
nextEnv.loadEnvConfig(process.cwd());
const { getDb, appMode } = await import("../src/lib/db");
if (appMode() !== "demo") throw new Error("Smoke fixtures require demo mode");
const db = await getDb();
const salt = randomBytes(16).toString("hex");
const password = "test-only-not-a-real-password";
const hash = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
await db.query(
  "INSERT INTO users(id,email,name,password_hash,role,is_demo) VALUES('test-ops','ops-test@company-os.local','Test Operations',$1,'OPERATIONS_MANAGER',false) ON CONFLICT(id) DO NOTHING",
  [hash],
);
await db.query(
  "UPDATE orders SET ordered_at=date_trunc('day',ordered_at) WHERE source='DEMO' AND ordered_at>now()",
);
console.log("Demo-only smoke fixtures prepared.");
process.exit(0);
