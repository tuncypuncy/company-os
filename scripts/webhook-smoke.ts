import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
// Isolated native fixture only. Never use real provider credentials/books.
if (
  !process.env.NATIVE_TEST_DATABASE_URL ||
  !process.env.NATIVE_TEST_CA_FILE ||
  !process.env.WEBHOOK_TEST_BASE_URL
)
  throw new Error("Explicit isolated fixture settings required");
process.env.APP_MODE = "live";
process.env.DATABASE_URL = process.env.NATIVE_TEST_DATABASE_URL;
process.env.DATABASE_CA_FILE = process.env.NATIVE_TEST_CA_FILE;
const { getDb } = await import("../src/lib/db");
const db = await getDb(),
  id = "fixture-" + randomUUID(),
  event = randomUUID(),
  base = process.env.WEBHOOK_TEST_BASE_URL;
const bytes = JSON.stringify({ id: "fictional-order", test: true });
const signature = createHmac("sha256", "fictional-webhook-test-only")
  .update(bytes)
  .digest("base64");
try {
  await db.query(
    "INSERT INTO integration_connections(id,platform,store_id,status,config) VALUES($1,'Shopify','gia','NOT_CONNECTED',$2::jsonb)",
    [
      id,
      JSON.stringify({
        shopDomain: "fixture.myshopify.com",
        apiVersion: "2026-10",
        entityId: "omurtak",
        tokenEnv: "SHOPIFY_FIXTURE_TOKEN",
        webhookSecretEnv: "SHOPIFY_FIXTURE_WEBHOOK_SECRET",
      }),
    ],
  );
  const headers = {
    "Content-Type": "application/json",
    "x-shopify-shop-domain": "fixture.myshopify.com",
    "x-shopify-topic": "orders/create",
    "x-shopify-event-id": event,
    "x-shopify-hmac-sha256": signature,
  };
  const post = (h: Record<string, string> = headers, body = bytes) =>
    fetch(base + "/api/webhooks/shopify/" + id, {
      method: "POST",
      headers: h,
      body,
    });
  assert.equal((await post()).status, 202);
  assert.equal((await post()).status, 202);
  assert.equal(
    (
      await db.query<{ n: number }>(
        "SELECT count(*)::int n FROM integration_events WHERE connection_id=$1",
        [id],
      )
    ).rows[0].n,
    1,
  );
  assert.equal((await post(headers, bytes + " ")).status, 401);
  assert.equal(
    (await post({ ...headers, "x-shopify-shop-domain": "other.myshopify.com" }))
      .status,
    401,
  );
  assert.equal(
    (await post({ ...headers, "x-shopify-topic": "unsupported/topic" })).status,
    422,
  );
  assert.equal(
    (
      await fetch(base + "/api/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://fixture.example",
        },
        body: JSON.stringify({ demo: true }),
      })
    ).status,
    403,
  );
  console.log(
    "PASS: live-mode fixture webhook HTTP signature/shop/topic rejection, durable duplicate-event prevention, and demo-entry rejection.",
  );
} finally {
  await db.query("DELETE FROM integration_events WHERE connection_id=$1", [id]);
  await db.query("DELETE FROM integration_connections WHERE id=$1", [id]);
}
process.exit(0);
