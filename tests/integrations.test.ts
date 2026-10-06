import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  ShopifyAdapter,
  shopifyConfig,
  verifyShopifySignature,
} from "../src/lib/integrations/shopify";
import { MetaAdapter, metaConfig } from "../src/lib/integrations/meta";
import { CJAdapter, cjConfig } from "../src/lib/integrations/cj";
import { apiJson } from "../src/lib/integrations/http";
test("Shopify HMAC uses raw bytes and rejects tampered payloads, domains and credential names", () => {
  const bytes = Buffer.from('{"id":1}'),
    secret = "fictional-fixture-secret",
    signature = createHmac("sha256", secret).update(bytes).digest("base64");
  assert.equal(verifyShopifySignature(bytes, signature, secret), true);
  assert.equal(
    verifyShopifySignature(Buffer.from('{"id":2}'), signature, secret),
    false,
  );
  assert.equal(verifyShopifySignature(bytes, "short", secret), false);
  assert.equal(
    shopifyConfig.safeParse({
      shopDomain: "attacker.example",
      apiVersion: "2026-10",
      tokenEnv: "SHOPIFY_ACCESS_TOKEN",
      webhookSecretEnv: "SHOPIFY_WEBHOOK_SECRET",
      entityId: "omurtak",
    }).success,
    false,
  );
});
test("Shopify paginates nested variants and carries secret only to the selected provider", async () => {
  let calls = 0;
  const adapter = new ShopifyAdapter(
    shopifyConfig.parse({
      shopDomain: "fixture.myshopify.com",
      apiVersion: "2026-10",
      tokenEnv: "SHOPIFY_ACCESS_TOKEN",
      webhookSecretEnv: "SHOPIFY_WEBHOOK_SECRET",
      entityId: "omurtak",
    }),
    "fictional-fixture-token",
    async (url, init) => {
      assert.equal(new URL(url).hostname, "fixture.myshopify.com");
      assert.equal(init?.redirect, "error");
      calls++;
      const body = JSON.parse(String(init?.body));
      return Response.json({
        data: body.query.includes("query Variants")
          ? {
              product: {
                variants: {
                  nodes: [{ id: "v2", sku: "SKU2" }],
                  pageInfo: { hasNextPage: false, endCursor: "end" },
                },
              },
            }
          : {
              products: {
                nodes: [
                  {
                    id: "p1",
                    title: "TEST jar",
                    status: "ACTIVE",
                    variants: {
                      nodes: [{ id: "v1", sku: "SKU1" }],
                      pageInfo: { hasNextPage: true, endCursor: "more" },
                    },
                  },
                ],
                pageInfo: { hasNextPage: false, endCursor: "end" },
              },
            },
      });
    },
  );
  const page = await adapter.products();
  assert.equal(page.nodes[0].variants.nodes.length, 2);
  assert.equal(calls, 2);
});
test("provider errors are sanitized and Meta pagination avoids following arbitrary next URLs", async () => {
  await assert.rejects(
    apiJson(
      "https://provider.example",
      {},
      async () => new Response("token=do-not-expose", { status: 401 }),
    ),
    /rejected credentials/,
  );
  const adapter = new MetaAdapter(
    metaConfig.parse({
      accountId: "act_123",
      apiVersion: "v24.0",
      tokenEnv: "META_ACCESS_TOKEN",
      entityId: "omurtak",
    }),
    "fictional-token",
    async (url) => {
      assert.equal(new URL(url).hostname, "graph.facebook.com");
      assert.ok(url.includes("time_increment=1"));
      return Response.json({
        data: [
          {
            date_start: "2026-10-06",
            date_stop: "2026-10-06",
            spend: "12.34",
            account_currency: "USD",
          },
        ],
        paging: {
          cursors: { after: "next-cursor" },
          next: "https://untrusted.example/steal",
        },
      });
    },
  );
  const page = await adapter.spend("2026-10-01", "2026-10-06");
  assert.equal(page.cursor, "next-cursor");
  assert.equal(page.records[0].spend, "12.34");
});
test("CJ cannot guess missing official profile and validates mapped inventory response semantics", async () => {
  const base = {
    tokenEnv: "CJ_ACCESS_TOKEN",
    entityId: "omurtak",
    supplierId: "supplier",
  };
  const unconfigured = new CJAdapter(cjConfig.parse(base), "fictional-token");
  await assert.rejects(unconfigured.inventory("sku"), /official documentation/);
  const configured = new CJAdapter(
    cjConfig.parse({
      ...base,
      verifiedProfile: {
        documentationUrl:
          "https://developers.cjdropshipping.com/verified-fixture",
        inventoryPath: "/api2.0/v1/test/fixture",
        skuParameter: "sku",
        rowsPath: "data.rows",
        availableField: "available",
        warehouseField: "warehouse",
        confirmed: true,
      },
    }),
    "fictional-token",
    async () =>
      Response.json({ data: { rows: [{ available: 5, warehouse: "wh1" }] } }),
  );
  assert.equal((await configured.inventory("sku"))[0].available, 5);
});
