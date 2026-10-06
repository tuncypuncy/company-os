import { randomUUID, createHash } from "node:crypto";
import type { Sql } from "../db";
import { minor } from "../finance";
import type { ShopifyProduct, ShopifyOrder } from "./shopify";
import { IntegrationError } from "./http";
const key = (connection: string, id: string) =>
  connection + "-" + createHash("sha256").update(id).digest("hex").slice(0, 24);
export type Connection = {
  id: string;
  platform: string;
  store_id: string;
  config: Record<string, unknown>;
  status: string;
  last_success_at: string | null;
};
export async function rawSource(
  tx: Sql,
  connection: string,
  kind: string,
  external: string,
  payload: unknown,
) {
  await tx.query(
    "INSERT INTO raw_source_records(id,connection_id,kind,external_id,payload,observed_at) VALUES($1,$2,$3,$4,$5::jsonb,now()) ON CONFLICT(connection_id,kind,external_id) DO UPDATE SET payload=EXCLUDED.payload,observed_at=EXCLUDED.observed_at",
    [randomUUID(), connection, kind, external, JSON.stringify(payload)],
  );
}
async function entityAt(
  tx: Sql,
  store: string,
  date: string,
  fallback: string,
) {
  const mappings = (
    await tx.query<{ legal_entity_id: string }>(
      "SELECT legal_entity_id FROM mapping_history WHERE store_id=$1 AND effective_start<=$2 AND (effective_end IS NULL OR effective_end>$2)",
      [store, date],
    )
  ).rows;
  if (mappings.length !== 1 || mappings[0].legal_entity_id !== fallback)
    throw new IntegrationError(
      "MAPPING",
      "Confirm an effective-dated legal entity mapping covering the imported order before ingestion",
    );
  return mappings[0].legal_entity_id;
}
async function productId(
  tx: Sql,
  c: Connection,
  external: string,
  title: string,
) {
  const id = key(c.id, external);
  const store = (
    await tx.query<{ brand_id: string }>(
      "SELECT brand_id FROM stores WHERE id=$1",
      [c.store_id],
    )
  ).rows[0];
  if (!store)
    throw new IntegrationError("MAPPING", "Unknown integration store");
  await tx.query(
    "INSERT INTO products(id,brand_id,name,status) VALUES($1,$2,$3,'UNMAPPED') ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name",
    [id, store.brand_id, title],
  );
  return id;
}
export async function ingestShopifyProduct(
  tx: Sql,
  c: Connection,
  p: ShopifyProduct,
) {
  const product = await productId(tx, c, p.id, p.title);
  await rawSource(tx, c.id, "PRODUCT", p.id, p);
  for (const variant of p.variants.nodes)
    await tx.query(
      "INSERT INTO variants(id,product_id,store_id,sku,external_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET sku=EXCLUDED.sku",
      [
        key(c.id, variant.id),
        product,
        c.store_id,
        variant.sku || "UNMAPPED-" + variant.id.split("/").at(-1),
        variant.id,
      ],
    );
}
export async function ingestShopifyOrder(
  tx: Sql,
  c: Connection,
  order: ShopifyOrder,
) {
  const currency = order.subtotalPriceSet.shopMoney.currencyCode;
  if (!["USD", "EUR", "GBP"].includes(currency))
    throw new IntegrationError(
      "CURRENCY",
      "Order currency requires a configured money precision before ingestion",
    );
  const entity = await entityAt(
    tx,
    c.store_id,
    order.createdAt.slice(0, 10),
    String(c.config.entityId),
  );
  const id = key(c.id, order.id),
    discount = minor(order.totalDiscountsSet.shopMoney.amount),
    subtotal = minor(order.subtotalPriceSet.shopMoney.amount),
    shipping = c.config.includeShipping
      ? minor(order.totalShippingPriceSet.shopMoney.amount)
      : 0;
  const platformRefund = order.refunds.reduce((n, r) => {
    if (r.totalRefundedSet.shopMoney.currencyCode !== currency)
      throw new IntegrationError("CURRENCY", "Refund currency mismatch");
    return n + minor(r.totalRefundedSet.shopMoney.amount);
  }, 0);
  await rawSource(tx, c.id, "ORDER", order.id, order);
  await tx.query(
    "INSERT INTO orders(id,store_id,legal_entity_id,external_id,ordered_at,currency,gross_minor,discount_minor,platform_refund_minor,source,status,financial_status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'SHOPIFY',$10,$11) ON CONFLICT(store_id,external_id) DO UPDATE SET gross_minor=EXCLUDED.gross_minor,discount_minor=EXCLUDED.discount_minor,platform_refund_minor=EXCLUDED.platform_refund_minor,status=EXCLUDED.status,financial_status=EXCLUDED.financial_status",
    [
      id,
      c.store_id,
      entity,
      order.id,
      order.createdAt,
      currency,
      subtotal + discount + shipping,
      discount,
      platformRefund,
      order.cancelledAt ? "CANCELLED" : "PLATFORM_REPORTED",
      order.displayFinancialStatus || "UNKNOWN",
    ],
  );
  for (const line of order.lineItems.nodes) {
    if (!line.quantity) continue;
    const external = line.variant?.product.id ?? "unmapped-" + line.id;
    const product = await productId(
      tx,
      c,
      external,
      line.variant?.product.title ?? "Unmapped Shopify line",
    );
    const variant = line.variant
      ? (
          await tx.query<{ bundle_size: number; product_id: string }>(
            "SELECT * FROM variants WHERE id=$1",
            [key(c.id, line.variant.id)],
          )
        ).rows[0]
      : null;
    // The reviewed commercial bundle size translates source line count to physical units; never guess bundles from SKU strings.
    const bundle = variant?.bundle_size ?? 1;
    await tx.query(
      "INSERT INTO order_items(id,order_id,product_id,sku,quantity,bundle_quantity) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET quantity=EXCLUDED.quantity,sku=EXCLUDED.sku",
      [
        key(c.id, line.id),
        id,
        variant?.product_id ?? product,
        line.sku,
        line.quantity * bundle,
        bundle,
      ],
    );
  }
  for (const refund of order.refunds)
    await tx.query(
      "INSERT INTO refunds(id,order_id,external_id,platform_minor,refunded_at,source) VALUES($1,$2,$3,$4,$5,'SHOPIFY') ON CONFLICT(order_id,external_id) WHERE external_id IS NOT NULL DO UPDATE SET platform_minor=EXCLUDED.platform_minor",
      [
        key(c.id, refund.id),
        id,
        refund.id,
        minor(refund.totalRefundedSet.shopMoney.amount),
        refund.createdAt,
      ],
    );
}
