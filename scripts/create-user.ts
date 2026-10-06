import nextEnv from "@next/env";
import { z } from "zod";
import { randomBytes, scryptSync, randomUUID } from "node:crypto";
nextEnv.loadEnvConfig(process.cwd());
const { getDb, appMode } = await import("../src/lib/db");
if (appMode() !== "live")
  throw new Error("Owner provisioning is for APP_MODE=live only");
const email = process.env.BOOTSTRAP_EMAIL?.trim().toLowerCase(),
  password = process.env.BOOTSTRAP_PASSWORD,
  name = process.env.BOOTSTRAP_NAME || "Owner";
if (
  !email ||
  !z.email().safeParse(email).success ||
  !password ||
  password.length < 14 ||
  password.length > 256
)
  throw new Error(
    "Set BOOTSTRAP_EMAIL and a BOOTSTRAP_PASSWORD of at least 14 characters securely",
  );
const role = process.env.BOOTSTRAP_ROLE || "OWNER";
if (!["OWNER", "OPERATIONS_MANAGER"].includes(role))
  throw new Error("BOOTSTRAP_ROLE must be OWNER or OPERATIONS_MANAGER");
const salt = randomBytes(16).toString("hex"),
  hash = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
await (
  await getDb()
).query(
  "INSERT INTO users(id,email,name,password_hash,role,is_demo) VALUES($1,$2,$3,$4,$5,false)",
  [randomUUID(), email, name, hash, role],
);
console.log(
  "Account created. Remove bootstrap credentials from the runtime environment.",
);
process.exit(0);
