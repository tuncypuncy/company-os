import { randomUUID } from "node:crypto";
import { invoiceSchema } from "./validation";
import type { Sql } from "./db";
export async function postInvoice(
  tx: Sql,
  data: unknown,
  actor: string,
  source: "DEMO" | "MANUAL",
) {
  const v = invoiceSchema.parse(data);
  if (v.createRules)
    await tx.exec("LOCK TABLE cost_rules IN SHARE ROW EXCLUSIVE MODE");
  const entity = await tx.query("SELECT id FROM legal_entities WHERE id=$1", [
    v.entityId,
  ]);
  const store = await tx.query<{ brand_id: string }>(
    "SELECT brand_id FROM stores WHERE id=$1",
    [v.storeId],
  );
  if (!entity.rows.length || !store.rows.length)
    throw new Error("Unknown entity or store");
  for (const i of v.items) {
    const product = await tx.query(
      "SELECT id FROM products WHERE id=$1 AND brand_id=$2",
      [i.productId, store.rows[0].brand_id],
    );
    if (!product.rows.length)
      throw new Error("Product does not belong to this store brand");
  }
  const id = randomUUID();
  await tx.query(
    "INSERT INTO invoices(id,vendor,invoice_number,legal_entity_id,store_id,currency,total_minor,invoice_date,effective_date,due_date,status,source,verification_status,notes,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'CONFIRMED',$11,$12,$13,$14)",
    [
      id,
      v.vendor,
      v.invoiceNumber,
      v.entityId,
      v.storeId,
      v.currency,
      v.total,
      v.invoiceDate,
      v.effectiveDate,
      v.dueDate,
      source,
      source === "DEMO" ? "DEMO" : "CONFIRMED",
      v.notes,
      actor,
    ],
  );
  for (const i of v.items) {
    await tx.query(
      "INSERT INTO invoice_items(id,invoice_id,product_id,quantity,bundle_quantity,product_minor,packaging_minor,fulfillment_minor,shipping_minor,other_minor) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [
        randomUUID(),
        id,
        i.productId,
        i.bundles,
        i.bundleQuantity,
        i.product,
        i.packaging,
        i.fulfillment,
        i.shipping,
        i.other,
      ],
    );
    if (v.createRules) {
      const conflicts = await tx.query(
        "SELECT id FROM cost_rules WHERE product_id=$1 AND store_id=$2 AND legal_entity_id=$3 AND bundle_quantity=$4 AND currency=$5 AND (effective_end IS NULL OR effective_end>$6)",
        [
          i.productId,
          v.storeId,
          v.entityId,
          i.bundleQuantity,
          v.currency,
          v.effectiveDate,
        ],
      );
      if (conflicts.rows.length)
        throw new Error(
          "An overlapping cost rule exists. Preserve historical rules; use a separate reviewed rule revision before posting new prices.",
        );
      await tx.query(
        "INSERT INTO cost_rules(id,product_id,store_id,legal_entity_id,bundle_quantity,currency,product_minor,packaging_minor,fulfillment_minor,shipping_minor,other_minor,effective_start,invoice_id,source,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)",
        [
          randomUUID(),
          i.productId,
          v.storeId,
          v.entityId,
          i.bundleQuantity,
          v.currency,
          i.product,
          i.packaging,
          i.fulfillment,
          i.shipping,
          i.other,
          v.effectiveDate,
          id,
          source,
          source === "DEMO" ? "DEMO" : "CONFIRMED",
        ],
      );
    }
  }
  await tx.query(
    "INSERT INTO obligations(id,legal_entity_id,store_id,invoice_id,title,category,currency,amount_minor,due_at,status,source,verification_status,created_by) VALUES($1,$2,$3,$4,$5,'Supplier',$6,$7,$8,'SCHEDULED',$9,$10,$11)",
    [
      randomUUID(),
      v.entityId,
      v.storeId,
      id,
      `${v.vendor} · ${v.invoiceNumber}`,
      v.currency,
      v.total,
      `${v.dueDate}T23:59:59Z`,
      source,
      source === "DEMO" ? "DEMO" : "CONFIRMED",
      actor,
    ],
  );
  return id;
}
