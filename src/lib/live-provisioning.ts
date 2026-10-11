import {
  randomBytes,
  randomUUID,
  scryptSync,
  pbkdf2Sync,
  createHmac,
  createHash,
} from "node:crypto";
import { z } from "zod";
import type { Database } from "./db";

export function setupTargets(
  adminUrl: string,
  runtimeUrl: string,
  projectUrl: string,
) {
  const admin = new URL(adminUrl),
    runtime = new URL(runtimeUrl),
    project = new URL(projectUrl);
  if (
    !["postgres:", "postgresql:"].includes(admin.protocol) ||
    !["postgres:", "postgresql:"].includes(runtime.protocol)
  )
    throw new Error("Database URLs must use PostgreSQL");
  if (
    project.protocol !== "https:" ||
    project.username ||
    project.password ||
    project.pathname !== "/" ||
    project.search ||
    project.hash ||
    !/^[a-z]{20}\.supabase\.co$/.test(project.hostname)
  )
    throw new Error("Supabase project identity is invalid");
  if (
    admin.hostname !== runtime.hostname ||
    (admin.port || "5432") !== (runtime.port || "5432") ||
    admin.pathname !== runtime.pathname ||
    (runtime.port || "5432") === "6543"
  )
    throw new Error(
      "Use the same direct/session database endpoint for admin and runtime",
    );
  if (
    !runtime.hostname.endsWith(".pooler.supabase.com") &&
    runtime.hostname !== "db." + project.hostname
  )
    throw new Error("Use the Supabase direct or session endpoint");
  const projectId = project.hostname.split(".")[0],
    username = decodeURIComponent(runtime.username);
  if (
    !["company_os_app", "company_os_app." + projectId].includes(username) ||
    decodeURIComponent(admin.username) === username
  )
    throw new Error("A separate company_os_app runtime login is required");
  if (
    runtime.hostname.endsWith(".pooler.supabase.com") &&
    (username !== "company_os_app." + projectId ||
      !decodeURIComponent(admin.username).endsWith("." + projectId))
  )
    throw new Error("Pooler usernames must match the configured project");
  if (
    runtime.hostname.endsWith(".supabase.co") &&
    runtime.hostname !== "db." + projectId + ".supabase.co"
  )
    throw new Error("Database project does not match storage project");
  if (
    !decodeURIComponent(runtime.password) ||
    !decodeURIComponent(admin.password)
  )
    throw new Error("Database credentials are missing");
  if (!/^[\x21-\x7e]{24,256}$/.test(decodeURIComponent(runtime.password)))
    throw new Error("Use a 24–256 character printable ASCII runtime password");
  return {
    runtimeRole: "company_os_app",
    runtimePassword: decodeURIComponent(runtime.password),
  };
}
export function ownerInput(
  email: string | undefined,
  password: string | undefined,
  name: string | undefined,
) {
  const parsed = z.email().safeParse(email?.trim().toLowerCase());
  if (
    !parsed.success ||
    (password && (password.length < 14 || password.length > 256)) ||
    !name?.trim() ||
    name.length > 200
  )
    throw new Error(
      "Valid owner email/name and a 14–256 character password are required",
    );
  return { email: parsed.data, password, name: name.trim() };
}
export async function ensureOwner(
  db: Database,
  input: ReturnType<typeof ownerInput>,
) {
  return db.transaction(async (tx) => {
    await tx.exec("LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE");
    const existing = (
      await tx.query<{
        role: string;
        active: boolean;
        is_demo: boolean;
        password_hash: string | null;
      }>("SELECT role,active,is_demo,password_hash FROM users WHERE email=$1", [
        input.email,
      ])
    ).rows[0];
    if (existing) {
      if (
        existing.role !== "OWNER" ||
        !existing.active ||
        existing.is_demo ||
        !existing.password_hash
      )
        throw new Error(
          "Existing account is not an active real owner; manual review required",
        );
      return "PRESERVED";
    }
    const other = (
      await tx.query(
        "SELECT id FROM users WHERE active=true AND is_demo=false AND role='OWNER' LIMIT 1",
      )
    ).rows[0];
    if (other)
      throw new Error(
        "A different owner already exists; no additional owner was created",
      );
    if (!input.password)
      throw new Error("Bootstrap password required for a new owner");
    const salt = randomBytes(16).toString("hex"),
      hash = salt + ":" + scryptSync(input.password, salt, 64).toString("hex"),
      id = randomUUID();
    await tx.query(
      "INSERT INTO users(id,email,name,password_hash,role,is_demo) VALUES($1,$2,$3,$4,'OWNER',false)",
      [id, input.email, input.name, hash],
    );
    await tx.query(
      "INSERT INTO audit_logs(table_name,record_id,action,next_value,actor_id) VALUES('user_access',$1,'BOOTSTRAP_OWNER',$2::jsonb,$1)",
      [id, JSON.stringify({ role: "OWNER", source: "MANUAL_SETUP" })],
    );
    return "CREATED";
  });
}

type Bucket = {
  public: boolean;
  file_size_limit?: number | null;
  allowed_mime_types?: string[] | null;
};
type StorageAdmin = {
  getBucket: (id: string) => Promise<{ data: Bucket | null; error: unknown }>;
  createBucket: (
    id: string,
    options: {
      public: boolean;
      fileSizeLimit: number;
      allowedMimeTypes: string[];
    },
  ) => Promise<{ error: unknown }>;
};
const mimeTypes = ["application/pdf", "image/png", "image/jpeg"];
function validBucket(bucket: Bucket | null) {
  if (
    !bucket ||
    bucket.public !== false ||
    !bucket.file_size_limit ||
    bucket.file_size_limit > 10 * 1024 * 1024 ||
    !bucket.allowed_mime_types ||
    bucket.allowed_mime_types.length !== 3 ||
    !mimeTypes.every((m) => bucket.allowed_mime_types!.includes(m))
  )
    throw new Error("Existing bucket requires manual privacy/limit review");
}
export async function ensurePrivateBucket(storage: StorageAdmin, id: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error("Invalid bucket identity");
  const found = await storage.getBucket(id);
  if (!found.error) {
    validBucket(found.data);
    return "PRESERVED";
  }
  const error = found.error as {
    status?: number;
    statusCode?: string | number;
  };
  if (Number(error.status ?? error.statusCode) !== 404)
    throw new Error("Storage access failed; no bucket created");
  const created = await storage.createBucket(id, {
    public: false,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: mimeTypes,
  });
  // Recheck instead of trusting creation response; supports a concurrent identical creator.
  const check = await storage.getBucket(id);
  if (check.error)
    throw new Error(
      created.error ? "Bucket creation failed" : "Bucket verification failed",
    );
  validBucket(check.data);
  return "CREATED";
}

export function postgresPasswordVerifier(password: string) {
  const salt = randomBytes(16),
    iterations = 4096,
    salted = pbkdf2Sync(
      password.normalize("NFKC"),
      salt,
      iterations,
      32,
      "sha256",
    );
  const clientKey = createHmac("sha256", salted).update("Client Key").digest();
  const storedKey = createHash("sha256").update(clientKey).digest("base64");
  const serverKey = createHmac("sha256", salted)
    .update("Server Key")
    .digest("base64");
  return (
    "SCRAM-SHA-256$" +
    iterations +
    ":" +
    salt.toString("base64") +
    "$" +
    storedKey +
    ":" +
    serverKey
  );
}
