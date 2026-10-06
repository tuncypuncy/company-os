import { randomUUID } from "node:crypto";
import { appMode, getDb, type Sql } from "@/lib/db";
import { limitedBody } from "@/lib/auth";
import { credential } from "@/lib/integrations/http";
import {
  shopifyConfig,
  verifyShopifySignature,
} from "@/lib/integrations/shopify";
import type { Connection } from "@/lib/integrations/ingest";
// Signed events are durably queued; owner sync reconciles the authoritative GraphQL source. Payloads are not guessed from webhook schemas.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ connection: string }> },
) {
  try {
    if (appMode() !== "live")
      return Response.json(
        { error: "Webhooks are disabled in demo mode" },
        { status: 403 },
      );
    const { connection } = await params,
      db = await getDb(),
      record = (
        await db.query<Connection>(
          "SELECT * FROM integration_connections WHERE id=$1 AND platform=$2",
          [connection, "Shopify"],
        )
      ).rows[0];
    if (!record || record.status === "DISCONNECTED")
      return new Response(null, { status: 404 });
    const config = shopifyConfig.parse(record.config),
      bytes = await limitedBody(request, 2 * 1024 * 1024),
      secret = credential(config.webhookSecretEnv, "SHOPIFY");
    if (
      request.headers.get("x-shopify-shop-domain") !== config.shopDomain ||
      !verifyShopifySignature(
        bytes,
        request.headers.get("x-shopify-hmac-sha256"),
        secret,
      )
    )
      return Response.json(
        { error: "Invalid webhook signature or shop" },
        { status: 401 },
      );
    const topic = request.headers.get("x-shopify-topic"),
      event =
        request.headers.get("x-shopify-event-id") ||
        request.headers.get("x-shopify-webhook-id");
    if (!topic || !event)
      return Response.json(
        { error: "Event identity is required" },
        { status: 400 },
      );
    const supported = [
      "orders/create",
      "orders/updated",
      "orders/cancelled",
      "refunds/create",
      "products/create",
      "products/update",
    ];
    if (!supported.includes(topic))
      return Response.json({ error: "Unsupported topic" }, { status: 422 });
    let payload: unknown;
    try {
      payload = JSON.parse(bytes.toString());
    } catch {
      return Response.json({ error: "Invalid event JSON" }, { status: 400 });
    }
    await db.transaction(async (tx: Sql) => {
      await tx.query(
        "INSERT INTO integration_events(id,connection_id,external_event_id,topic,payload) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(connection_id,external_event_id) DO NOTHING",
        [randomUUID(), connection, event, topic, JSON.stringify(payload)],
      );
    });
    return Response.json({ status: "QUEUED" }, { status: 202 });
  } catch {
    return Response.json(
      { error: "Webhook could not be accepted" },
      { status: 503 },
    );
  }
}
