import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";
import { postgresConfig } from "../src/lib/postgres-config";
test("pg connection parsing cannot override verified TLS or isolated schema", () => {
  for (const override of [
    "ssl=0",
    "ssl=no-verify",
    "sslmode=disable",
    "sslmode=no-verify",
    "sslnegotiation=direct",
    "sslrootcert=/not/a/certificate",
  ]) {
    const client = new Client(
      postgresConfig(
        `postgresql://fictional:example@db.example/company?${override}&options=unsafe`,
        "trusted-ca",
      ),
    );
    // Inspect the actual pg parser without opening a network connection.
    const params = (
      client as unknown as {
        connectionParameters: { ssl: unknown; options: string };
      }
    ).connectionParameters;
    assert.deepEqual(params.ssl, {
      ca: "trusted-ca",
      rejectUnauthorized: true,
    });
    assert.equal(params.options, "-c search_path=company_os,public");
  }
});
