import { randomUUID } from "node:crypto";
import { z } from "zod";
import { appMode, actorTransaction, getDb } from "../db";
import { HttpError } from "../auth";
import { minor } from "../finance";
import { ShopifyAdapter, shopifyConfig } from "./shopify";
import { MetaAdapter, metaConfig } from "./meta";
import { CJAdapter, cjConfig } from "./cj";
import { credential, IntegrationError } from "./http";
import {
  ingestShopifyProduct,
  ingestShopifyOrder,
  rawSource,
  type Connection,
} from "./ingest";
export const connectionSchema = z
  .object({
    platform: z.enum(["Shopify", "Meta", "CJ"]),
    storeId: z.string().min(1),
    config: z.record(z.string(), z.unknown()),
  })
  .strict();
export function parseConfig(platform: string, config: unknown) {
  if (platform === "Shopify") return shopifyConfig.parse(config);
  if (platform === "Meta") return metaConfig.parse(config);
  return cjConfig.parse(config);
}
export async function connectionList(storeId: string) {
  const db = await getDb();
  const rows = (
    await db.query<
      Connection & { last_error: string | null; freshness_hours: number }
    >(
      "SELECT * FROM integration_connections WHERE store_id=$1 ORDER BY platform",
      [storeId],
    )
  ).rows;
  return rows.map((c) => {
    const env = String(c.config.tokenEnv || "");
    return {
      ...c,
      credentialsPresent: !!env && !!process.env[env],
      freshness: c.last_success_at
        ? Date.now() - Date.parse(c.last_success_at) >
          c.freshness_hours * 3600000
          ? "STALE"
          : "CURRENT"
        : "NEVER_SYNCED",
    };
  });
}
export async function syncConnection(
  id: string,
  actor: string,
  mode: "check" | "sync",
  since?: string,
) {
  const db = await getDb(),
    c = (
      await db.query<Connection>(
        "SELECT * FROM integration_connections WHERE id=$1",
        [id],
      )
    ).rows[0];
  if (!c) throw new HttpError(404, "Connection not found");
  const config = parseConfig(c.platform, c.config),
    name = String(config.tokenEnv);
  if (!process.env[name])
    throw new IntegrationError("NOT_CONNECTED", name + " is not configured");
  if (appMode() !== "live")
    throw new HttpError(
      403,
      "Live APIs are disabled in demo mode; use fixture/manual source records",
    );
  const token = credential(
      name,
      c.platform === "Shopify" ? "SHOPIFY" : c.platform.toUpperCase(),
    ),
    sid = randomUUID();
  await db.query(
    "INSERT INTO integration_syncs(id,connection_id,started_at,status) VALUES($1,$2,now(),'RUNNING')",
    [sid, id],
  );
  try {
    let count = 0,
      cursor: string | null = null;
    if (c.platform === "Shopify") {
      const adapter = new ShopifyAdapter(shopifyConfig.parse(config), token);
      await adapter.check();
      if (mode === "sync") {
        let pages = 0;
        do {
          if (++pages > 200)
            throw new IntegrationError(
              "PAGINATION",
              "Resume catalog sync in a bounded window",
            );
          const page = await adapter.products(cursor);
          await actorTransaction(actor, async (tx) => {
            for (const product of page.nodes)
              await ingestShopifyProduct(tx, c, product);
          });
          count += page.nodes.length;
          cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
        } while (cursor);
        const start =
          since ||
          (c.last_success_at
            ? new Date(Date.parse(c.last_success_at) - 5 * 60000).toISOString()
            : null) ||
          new Date(Date.now() - 7 * 86400000).toISOString();
        pages = 0;
        do {
          if (++pages > 200)
            throw new IntegrationError(
              "PAGINATION",
              "Resume order sync in a smaller date window",
            );
          const page = await adapter.orders(start, cursor);
          await actorTransaction(actor, async (tx) => {
            for (const order of page.nodes)
              await ingestShopifyOrder(tx, c, order);
          });
          count += page.nodes.length;
          cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
        } while (cursor);
      }
    } else if (c.platform === "Meta") {
      const adapter = new MetaAdapter(metaConfig.parse(config), token),
        account = await adapter.check();
      if (!["USD", "EUR", "GBP"].includes(account.currency))
        throw new IntegrationError(
          "CURRENCY",
          "Configure account currency precision",
        );
      if (mode === "sync") {
        const aid = "integration-" + id;
        await actorTransaction(actor, async (tx) => {
          await tx.query(
            "INSERT INTO ad_accounts(id,platform,store_id,legal_entity_id,external_id,currency) VALUES($1,'META',$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING",
            [aid, c.store_id, config.entityId, account.id, account.currency],
          );
          await rawSource(tx, id, "ACCOUNT", account.id, account);
        });
        let after: string | undefined,
          pages = 0;
        do {
          if (++pages > 200)
            throw new IntegrationError(
              "PAGINATION",
              "Meta page limit exceeded",
            );
          const page = await adapter.spend(
            (
              since ||
              c.last_success_at ||
              new Date(Date.now() - 7 * 86400000).toISOString()
            ).slice(0, 10),
            new Date().toISOString().slice(0, 10),
            after,
          );
          await actorTransaction(actor, async (tx) => {
            for (const row of page.records) {
              if (row.account_currency !== account.currency)
                throw new IntegrationError(
                  "CURRENCY",
                  "Meta spend currency mismatch",
                );
              await tx.query(
                "INSERT INTO ad_spend(id,account_id,spend_date,actual_minor,source,status) VALUES($1,$2,$3,$4,'META','PLATFORM_REPORTED') ON CONFLICT(account_id,spend_date) DO UPDATE SET actual_minor=EXCLUDED.actual_minor",
                [randomUUID(), aid, row.date_start, minor(row.spend)],
              );
              await rawSource(tx, id, "SPEND", row.date_start, row);
            }
          });
          count += page.records.length;
          after = page.cursor || undefined;
        } while (after);
        after = undefined;
        pages = 0;
        let budget = 0;
        do {
          if (++pages > 200)
            throw new IntegrationError(
              "PAGINATION",
              "Meta budget page limit exceeded",
            );
          const page = await adapter.budgets(after);
          for (const adset of page.data) {
            await actorTransaction(actor, (tx) =>
              rawSource(tx, id, "ADSET", adset.id, adset),
            );
            if (adset.status === "ACTIVE" && adset.daily_budget)
              budget += Number(adset.daily_budget);
          }
          after = page.paging?.next ? page.paging.cursors?.after : undefined;
        } while (after);
        if (!Number.isSafeInteger(budget))
          throw new IntegrationError("PAYLOAD", "Invalid Meta budget");
        await db.query(
          "INSERT INTO ad_budgets(id,account_id,daily_minor,effective_at,source) VALUES($1,$2,$3,now(),'META_ACTIVE_ADSET_SUM')",
          [randomUUID(), aid, budget],
        );
      }
    } else {
      const adapter = new CJAdapter(cjConfig.parse(config), token);
      if (!adapter.config.verifiedProfile)
        throw new IntegrationError(
          "DOCUMENTATION_REQUIRED",
          "CJ official endpoint/response profile must be verified; manual inventory remains fully usable",
        );
      const skus = (
        await db.query<{ id: string; sku: string }>(
          "SELECT id,sku FROM supplier_skus WHERE supplier_id=$1",
          [adapter.config.supplierId],
        )
      ).rows;
      if (!skus.length)
        throw new IntegrationError(
          "MAPPING",
          "Add verified supplier SKUs before CJ checks",
        );
      for (const sku of mode === "check" ? skus.slice(0, 1) : skus) {
        const records = await adapter.inventory(sku.sku);
        if (mode === "sync")
          await actorTransaction(actor, async (tx) => {
            for (const row of records) {
              const warehouse = (
                await tx.query<{ id: string }>(
                  "SELECT id FROM warehouses WHERE id=$1 AND supplier_id=$2",
                  [row.warehouseId, adapter.config.supplierId],
                )
              ).rows[0];
              if (!warehouse)
                throw new IntegrationError(
                  "MAPPING",
                  "CJ warehouse IDs must be explicitly mapped before stock ingestion",
                );
              await tx.query(
                "INSERT INTO inventory_snapshots(id,supplier_sku_id,warehouse_id,available,observed_at,source,status) VALUES($1,$2,$3,$4,now(),'CJ','PLATFORM_REPORTED')",
                [randomUUID(), sku.id, warehouse.id, row.available],
              );
              await rawSource(
                tx,
                id,
                "INVENTORY",
                sku.id + ":" + warehouse.id,
                row.raw,
              );
            }
          });
        count += records.length;
      }
    }
    if (mode === "sync")
      await db.query(
        "UPDATE integration_events SET status='PROCESSED',processed_at=now() WHERE connection_id=$1 AND status='RECEIVED' AND received_at<=(SELECT started_at FROM integration_syncs WHERE id=$2)",
        [id, sid],
      );
    await db.query(
      "UPDATE integration_syncs SET status='SUCCESS',completed_at=now() WHERE id=$1",
      [sid],
    );
    await db.query(
      "UPDATE integration_connections SET status=$2,last_success_at=CASE WHEN $2='CONNECTED' THEN now() ELSE last_success_at END,last_error=NULL WHERE id=$1",
      [id, mode === "sync" ? "CONNECTED" : "ACCESS_VERIFIED"],
    );
    return {
      records: count,
      status: mode === "sync" ? "CONNECTED" : "ACCESS_VERIFIED",
    };
  } catch (error) {
    const message =
      error instanceof IntegrationError
        ? error.message
        : "Integration sync failed; review provider permissions and mappings";
    await db.query(
      "UPDATE integration_syncs SET status='FAILED',completed_at=now(),error_message=$2 WHERE id=$1",
      [sid, message],
    );
    await db.query(
      "UPDATE integration_connections SET status='ERROR',last_error=$2 WHERE id=$1",
      [id, message],
    );
    throw new IntegrationError("SYNC", message);
  }
}
