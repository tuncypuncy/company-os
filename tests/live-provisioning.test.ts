import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { migrate, type Database } from "../src/lib/db";
import {
  setupTargets,
  ownerInput,
  ensureOwner,
  ensurePrivateBucket,
} from "../src/lib/live-provisioning";
const project = "abcdefghijklmnopqrst",
  host = "aws-1-eu-central-1.pooler.supabase.com";
const admin =
  "postgresql://postgres." +
  project +
  ":fixture-admin@" +
  host +
  ":5432/postgres";
const runtime =
  "postgresql://company_os_app." +
  project +
  ":fictional-runtime-password-1234@" +
  host +
  ":5432/postgres";
const url = "https://" + project + ".supabase.co";
test("live setup separates database identities and rejects wrong projects/transaction pooler", () => {
  assert.equal(setupTargets(admin, runtime, url).runtimeRole, "company_os_app");
  assert.throws(() => setupTargets(admin, admin, url), /separate/);
  assert.throws(
    () => setupTargets(admin, runtime.replace(":5432", ":6543"), url),
    /endpoint/,
  );
  assert.throws(
    () => setupTargets(admin, runtime, url.replace(project, "z".repeat(20))),
    /project|runtime/,
  );
  assert.throws(
    () =>
      setupTargets(
        admin.replace(host, "example.com"),
        runtime.replace(host, "example.com"),
        url,
      ),
    /Supabase/,
  );
});
test("owner bootstrap creates once without seed, preserves password and refuses role escalation/conflicts", async () => {
  const engine = new PGlite();
  const db: Database = {
    exec: async (s) => {
      await engine.exec(s);
    },
    query: (s, p) => engine.query(s, p),
    transaction: (fn) =>
      engine.transaction((tx) =>
        fn({
          exec: async (s) => {
            await tx.exec(s);
          },
          query: (s, p) => tx.query(s, p),
        }),
      ),
  };
  try {
    await migrate(db);
    const input = ownerInput(
      "fixture-owner@example.com",
      "fictional-owner-password-123",
      "Fixture Owner",
    );
    assert.equal(await ensureOwner(db, input), "CREATED");
    const original = (
      await db.query<{ password_hash: string }>(
        "SELECT password_hash FROM users",
      )
    ).rows[0].password_hash;
    assert.equal(
      await ensureOwner(db, ownerInput(input.email, undefined, input.name)),
      "PRESERVED",
    );
    assert.equal(
      (
        await db.query<{ password_hash: string }>(
          "SELECT password_hash FROM users",
        )
      ).rows[0].password_hash,
      original,
    );
    assert.equal(
      (await db.query<{ n: number }>("SELECT count(*)::int n FROM orders"))
        .rows[0].n,
      0,
    );
    await assert.rejects(
      ensureOwner(
        db,
        ownerInput(
          "other@example.com",
          "fictional-owner-password-123",
          "Other",
        ),
      ),
      /different owner/,
    );
    await db.query("UPDATE users SET role='OPERATIONS_MANAGER'");
    await assert.rejects(ensureOwner(db, input), /manual review/);
    const audits = JSON.stringify(
      (
        await db.query(
          "SELECT next_value FROM audit_logs WHERE table_name='user_access'",
        )
      ).rows,
    );
    assert.ok(!audits.includes(original) && !audits.includes(input.password!));
  } finally {
    await engine.close();
  }
});
test("private bucket is created only after 404 and verified without updating existing policy", async () => {
  let calls = 0,
    created = false;
  const storage = {
    getBucket: async () => {
      calls++;
      return created
        ? {
            data: {
              public: false,
              file_size_limit: 10485760,
              allowed_mime_types: [
                "application/pdf",
                "image/png",
                "image/jpeg",
              ],
            },
            error: null,
          }
        : { data: null, error: { statusCode: "404" } };
    },
    createBucket: async (_id: string, options: { public: boolean }) => {
      assert.equal(options.public, false);
      created = true;
      return { error: null };
    },
  };
  assert.equal(
    await ensurePrivateBucket(storage, "company-os-invoices"),
    "CREATED",
  );
  assert.equal(calls, 2);
  assert.equal(
    await ensurePrivateBucket(storage, "company-os-invoices"),
    "PRESERVED",
  );
});
test("storage authentication failure or existing public bucket cannot trigger creation or conversion", async () => {
  let creates = 0;
  const createBucket = async () => {
    creates++;
    return { error: null };
  };
  await assert.rejects(
    ensurePrivateBucket(
      {
        getBucket: async () => ({ data: null, error: { status: 401 } }),
        createBucket,
      },
      "company-os-invoices",
    ),
    /access/,
  );
  await assert.rejects(
    ensurePrivateBucket(
      {
        getBucket: async () => ({ data: { public: true }, error: null }),
        createBucket,
      },
      "company-os-invoices",
    ),
    /privacy/,
  );
  await assert.rejects(
    ensurePrivateBucket(
      {
        getBucket: async () => ({
          data: { public: false, file_size_limit: null },
          error: null,
        }),
        createBucket,
      },
      "company-os-invoices",
    ),
    /privacy/,
  );
  assert.equal(creates, 0);
});
