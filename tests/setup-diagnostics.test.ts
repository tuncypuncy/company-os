import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  configurationResults,
  connectWithDiagnostics,
  safeErrorCodes,
  requireVerifiedTls,
} from "../src/lib/setup-diagnostics";
import { ensurePrivateBucket } from "../src/lib/live-provisioning";

const project = "abcdefghijklmnopqrst";
const fixture: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  APP_MODE: "live",
  APP_ORIGIN: "https://company-os-eight-iota.vercel.app",
  PRIVATE_STORAGE_PROVIDER: "supabase",
  DATABASE_MIGRATION_URL: `postgresql://postgres.${project}:fictional-admin-password@aws-1-eu-central-1.pooler.supabase.com:5432/postgres`,
  DATABASE_URL: `postgresql://company_os_app.${project}:fictional-runtime-password-long@aws-1-eu-central-1.pooler.supabase.com:5432/postgres`,
  SUPABASE_URL: `https://${project}.supabase.co`,
  SUPABASE_SERVICE_ROLE_KEY: "fictional-key",
  BOOTSTRAP_EMAIL: "owner@example.com",
  BOOTSTRAP_NAME: "Fictional Owner",
};
test("configuration checks every setting without leaking any supplied values", () => {
  const result = configurationResults(fixture);
  assert.equal(
    result.some((r) => r.result === "FAIL"),
    false,
  );
  for (const key of Object.keys(fixture).filter((key) => key !== "NODE_ENV"))
    assert.ok(result.some((r) => r.setting === key));
  const invalid = configurationResults({
    ...fixture,
    DATABASE_URL: "secret-not-a-url",
    BOOTSTRAP_EMAIL: "private-invalid",
    DATABASE_CA_CERT: "private-invalid-cert",
    BOOTSTRAP_PASSWORD: "short",
  });
  assert.ok(invalid.filter((r) => r.result === "FAIL").length >= 4);
  for (const value of [
    "secret-not-a-url",
    "private-invalid",
    "short",
    fixture.DATABASE_URL!,
  ])
    assert.ok(!JSON.stringify(invalid).includes(value));
});
test("error diagnostics only emit allowlisted codes, including nested TLS and aggregate network errors", () => {
  const error = new AggregateError(
    [
      { code: "ENOTFOUND", hostname: "secret-host" },
      { code: "secret-code", message: "secret-password" },
    ],
    "secret-url",
    {
      cause: {
        code: "CERT_HAS_EXPIRED",
        statusCode: "403",
        stack: "private-stack",
      },
    },
  );
  assert.deepEqual(safeErrorCodes(error), [
    "CERT_HAS_EXPIRED",
    "ENOTFOUND",
    "HTTP_403",
  ]);
  assert.deepEqual(
    safeErrorCodes({ code: "secret-password", status: "403 secret" }),
    ["UNKNOWN_ERROR"],
  );
  assert.deepEqual(
    safeErrorCodes(
      Object.defineProperty({}, "code", {
        get() {
          throw new Error("must not execute getter");
        },
      }),
    ),
    ["UNKNOWN_ERROR"],
  );
  const circular = { code: "28P01", cause: null as unknown };
  circular.cause = circular;
  assert.deepEqual(safeErrorCodes(circular), ["28P01"]);
});
test("TLS verification reports separate safe failure codes and never accepts unverified encryption", () => {
  assert.throws(
    () => requireVerifiedTls({}),
    (e) => safeErrorCodes(e)[0] === "TLS_NOT_ENCRYPTED",
  );
  assert.throws(
    () => requireVerifiedTls({ encrypted: true, authorized: false }),
    (e) => safeErrorCodes(e)[0] === "TLS_NOT_AUTHORIZED",
  );
  requireVerifiedTls({ encrypted: true, authorized: true });
});
test("storage preserves only safe provider diagnostic codes through its error boundary", async () => {
  await assert.rejects(
    ensurePrivateBucket(
      {
        getBucket: async () => ({
          data: null,
          error: { statusCode: "401", message: "private-provider-message" },
        }),
        createBucket: async () => {
          throw new Error("must not create");
        },
      },
      "invoices",
    ),
    (e) => {
      assert.deepEqual(safeErrorCodes(e), ["HTTP_401"]);
      return true;
    },
  );
});
test("CLI configuration failure reports all checks, exits unsuccessfully and does not attempt connection or expose secrets", () => {
  // Intentionally invalid config prevents any network access; never inherit injected live credentials.
  const child = spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/github-live-setup.ts"],
    {
      env: {
        PATH: process.env.PATH,
        ...fixture,
        APP_MODE: "invalid",
        DATABASE_URL: "private-fixture-secret-url",
      },
      encoding: "utf8",
    },
  );
  assert.equal(child.status, 1);
  const output = child.stdout + child.stderr;
  assert.match(output, /CONFIG: BOOTSTRAP_NAME/);
  assert.match(output, /stage=configuration codes=CONFIG_INVALID/);
  assert.ok(!output.includes("STAGE: admin connection"));
  for (const value of [
    "private-fixture-secret-url",
    "fictional-key",
    "fictional-admin-password",
    "owner@example.com",
    "Fictional Owner",
    "aws-1-eu-central-1.pooler.supabase.com",
  ])
    assert.ok(!output.includes(value));
});

test("connection failures retain their original code and distinguish TLS from authentication/network phases", async () => {
  for (const code of [
    "28P01",
    "ENOTFOUND",
    "CERT_HAS_EXPIRED",
    "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  ]) {
    let phase = "admin connection";
    const error = { code, message: "secret connection URL" };
    await assert.rejects(
      connectWithDiagnostics(
        async () => {
          throw error;
        },
        () => {
          phase = "admin TLS handshake";
        },
      ),
      (e) => e === error,
    );
    assert.equal(
      phase,
      code === "28P01" || code === "ENOTFOUND"
        ? "admin connection"
        : "admin TLS handshake",
    );
  }
});
