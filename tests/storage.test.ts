import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  storeFile,
  loadFile,
  removeFile,
  storageCheck,
} from "../src/lib/storage";
test("private storage fails closed, preserves object location, and supports upload/download/cleanup", async () => {
  const names = [
    "APP_MODE",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_STORAGE_BUCKET",
    "PRIVATE_STORAGE_PROVIDER",
  ];
  const previous = Object.fromEntries(
    names.map((name) => [name, process.env[name]]),
  );
  const originalFetch = global.fetch;
  let isPublic = true;
  let uploaded = false;
  let removed = false;
  try {
    Object.assign(process.env, {
      APP_MODE: "live",
      SUPABASE_URL: "https://storage-test.example",
      SUPABASE_SERVICE_ROLE_KEY: "fictional-contract-test-key",
      SUPABASE_STORAGE_BUCKET: "invoices",
      PRIVATE_STORAGE_PROVIDER: "supabase",
    });
    global.fetch = async (input, init) => {
      const url = String(input);
      if (url.endsWith("/bucket/invoices"))
        return Response.json({
          id: "invoices",
          name: "invoices",
          public: isPublic,
        });
      if (init?.method === "POST") {
        uploaded = true;
        return Response.json({ Key: "invoices/test", Id: randomUUID() });
      }
      if (init?.method === "DELETE") {
        removed = true;
        return Response.json([]);
      }
      return new Response("private bytes", {
        headers: { "Content-Type": "application/pdf" },
      });
    };
    await assert.rejects(storageCheck(), /private storage bucket/);
    const key = randomUUID();
    await assert.rejects(
      storeFile(key, Buffer.from("private bytes"), "application/pdf"),
      /private storage bucket/,
    );
    assert.equal(uploaded, false);
    isPublic = false;
    const file = await storeFile(
      key,
      Buffer.from("private bytes"),
      "application/pdf",
    );
    assert.equal(file.storage_bucket, "invoices");
    assert.equal(uploaded, true);
    process.env.SUPABASE_STORAGE_BUCKET = "different-bucket";
    assert.equal((await loadFile(file)).toString(), "private bytes");
    await removeFile(file);
    assert.equal(removed, true);
    await assert.rejects(
      loadFile({ ...file, storage_key: "../secret" }),
      /Invalid attachment key/,
    );
  } finally {
    global.fetch = originalFetch;
    for (const name of names)
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
  }
});
