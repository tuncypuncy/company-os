import { createClient } from "@supabase/supabase-js";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { appMode } from "./db";

export type StoredFile = {
  storage_key: string;
  storage_provider: "local" | "supabase";
  storage_bucket: string | null;
};
function localDirectory() {
  return path.resolve(
    appMode() === "demo"
      ? ".data/demo-attachments"
      : process.env.PRIVATE_FILES_DIR || ".data/attachments",
  );
}
function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error("Private storage credentials are not configured");
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  )
    throw new Error("SUPABASE_URL must be an HTTPS project origin");
  return createClient(url, key, {
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          redirect: "error",
          signal: init?.signal
            ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)])
            : AbortSignal.timeout(15000),
        }),
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
function validateKey(key: string) {
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(key)
  )
    throw new Error("Invalid attachment key");
}
async function privateBucket(bucket: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(bucket))
    throw new Error("Invalid private storage bucket");
  const api = client().storage;
  const { data, error } = await api.getBucket(bucket);
  if (error || !data || data.public !== false)
    throw new Error("A verified private storage bucket is required");
  return api.from(bucket);
}
export async function storageCheck() {
  if (appMode() !== "live") return { provider: "local", mode: "demo" };
  if (process.env.PRIVATE_STORAGE_PROVIDER === "supabase") {
    const bucket = process.env.SUPABASE_STORAGE_BUCKET;
    if (!bucket) throw new Error("SUPABASE_STORAGE_BUCKET is required");
    await privateBucket(bucket);
    return { provider: "supabase", mode: "live" };
  }
  if (
    process.env.PRIVATE_STORAGE_PROVIDER !== "local" ||
    process.env.DURABLE_STORAGE_CONFIRMED !== "true"
  )
    throw new Error(
      "Configure private durable storage before uploading live invoices",
    );
  await mkdir(localDirectory(), { recursive: true, mode: 0o700 });
  return { provider: "local", mode: "live" };
}
export async function storeFile(
  key: string,
  bytes: Buffer,
  type: string,
): Promise<StoredFile> {
  validateKey(key);
  if (
    appMode() === "live" &&
    process.env.PRIVATE_STORAGE_PROVIDER === "supabase"
  ) {
    const bucket = process.env.SUPABASE_STORAGE_BUCKET;
    if (!bucket) throw new Error("SUPABASE_STORAGE_BUCKET is required");
    const api = await privateBucket(bucket);
    const { error } = await api.upload(key, bytes, {
      contentType: type,
      upsert: false,
    });
    if (error) throw new Error("Private attachment upload failed");
    return {
      storage_key: key,
      storage_provider: "supabase",
      storage_bucket: bucket,
    };
  }
  await storageCheck();
  await mkdir(localDirectory(), { recursive: true, mode: 0o700 });
  await writeFile(path.join(localDirectory(), key), bytes, {
    mode: 0o600,
    flag: "wx",
  });
  return { storage_key: key, storage_provider: "local", storage_bucket: null };
}
export async function loadFile(file: StoredFile) {
  validateKey(file.storage_key);
  if (file.storage_provider === "supabase") {
    if (appMode() !== "live" || !file.storage_bucket)
      throw new Error("Invalid attachment storage configuration");
    const api = await privateBucket(file.storage_bucket);
    const { data, error } = await api.download(file.storage_key);
    if (error || !data) throw new Error("Private attachment download failed");
    return Buffer.from(await data.arrayBuffer());
  }
  if (file.storage_provider !== "local")
    throw new Error("Unknown storage provider");
  return readFile(path.join(localDirectory(), file.storage_key));
}
export async function removeFile(file: StoredFile) {
  validateKey(file.storage_key);
  if (file.storage_provider === "supabase") {
    if (!file.storage_bucket) throw new Error("Missing storage bucket");
    const api = await privateBucket(file.storage_bucket);
    const { error } = await api.remove([file.storage_key]);
    if (error) throw new Error("Private attachment cleanup failed");
  } else {
    await unlink(path.join(localDirectory(), file.storage_key));
  }
}
