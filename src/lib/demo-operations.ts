import type { Database } from "./db";
export async function seedDemoOperations(db: Database) {
  if (
    (
      await db.query(
        "SELECT version FROM schema_migrations WHERE version='demo-operations-v2'",
      )
    ).rows.length
  )
    return;
  await db.transaction(async (tx) => {
    await tx.query(
      "INSERT INTO vendors(id,name,kind) VALUES('demo-supplier','DEMO supplier — fictional','SUPPLIER') ON CONFLICT DO NOTHING",
    );
    await tx.query(
      "INSERT INTO warehouses(id,name,country,supplier_id) VALUES('demo-us','DEMO US warehouse','US','demo-supplier'),('demo-cn','DEMO China warehouse','CN','demo-supplier') ON CONFLICT DO NOTHING",
    );
    for (const store of ["gia", "gia-usa"])
      for (const [p, available] of [
        ["jar", 18000],
        ["trivia", 24000],
        ["cards", 15000],
      ] as [string, number][]) {
        const supplierSku = "demo-supplier-" + p,
          variant = "demo-variant-" + store + "-" + p,
          sku = "DEMO-" + store + "-" + p;
        await tx.query(
          "INSERT INTO supplier_skus(id,supplier_id,sku,product_id) VALUES($1,'demo-supplier',$2,$3) ON CONFLICT DO NOTHING",
          [supplierSku, "DEMO-SUP-" + p, p],
        );
        await tx.query(
          "INSERT INTO variants(id,product_id,store_id,sku,bundle_size) VALUES($1,$2,$3,$4,2) ON CONFLICT DO NOTHING",
          [variant, p, store, sku],
        );
        await tx.query(
          "INSERT INTO sku_mappings(variant_id,supplier_sku_id,status) VALUES($1,$2,'DEMO') ON CONFLICT DO NOTHING",
          [variant, supplierSku],
        );
        await tx.query(
          "UPDATE order_items SET sku=$3 WHERE product_id=$1 AND order_id IN (SELECT id FROM orders WHERE store_id=$2 AND source='DEMO') AND sku IS NULL",
          [p, store, sku],
        );
        for (const [wh, factor] of [
          ["demo-us", 1],
          ["demo-cn", 2],
        ] as [string, number][])
          await tx.query(
            "INSERT INTO inventory_snapshots(id,supplier_sku_id,warehouse_id,available,reserved,on_hand,observed_at,source,status) VALUES($1,$2,$3,$4,0,$4,now(),'DEMO','DEMO') ON CONFLICT DO NOTHING",
            ["demo-stock-" + wh + "-" + p, supplierSku, wh, available * factor],
          );
      }
    for (const store of ["gia", "gia-usa"]) {
      await tx.query(
        "INSERT INTO workspace_settings(store_id,currency,safety_buffer_minor,refund_policy) VALUES($1,'USD',8000000,'INTERNAL_REVIEWED') ON CONFLICT DO NOTHING",
        [store],
      );
      await tx.query(
        "UPDATE meta_billing_accounts SET clearing_days=2 WHERE id=$1",
        ["billing-" + store],
      );
    }
    await tx.query(
      "INSERT INTO schema_migrations(version) VALUES('demo-operations-v2')",
    );
  });
}
