import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { migrate, type Database } from "../src/lib/db";
import { seedDemo } from "../src/lib/seed";
import { parseOperation, executeOperation } from "../src/lib/operations";
import { operationalWorkspace } from "../src/lib/operational-workspace";
import { postInvoice } from "../src/lib/invoices";
test("operational flows persist, retain histories and reject duplicate financial/inventory posting", async () => {
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
    await seedDemo(db);
    global.companyOsDatabase = Promise.resolve(db);
    const cmd = (action: string, values: Record<string, string>) =>
      parseOperation(
        {
          action,
          storeId: "gia",
          entityId: "omurtak",
          currency: "USD",
          values,
        },
        { role: "OWNER" },
      );
    const run = (action: string, values: Record<string, string>) =>
      db.transaction(async (tx) => {
        await tx.query("SELECT set_config('app.actor_id','demo-owner',true)");
        return executeOperation(tx, cmd(action, values), "demo-owner");
      });
    const rec = await run("recurring", {
      vendor: "TEST app",
      category: "SaaS",
      amount: "10.00",
      frequency: "MONTHLY",
      nextDue: "2026-01-31",
    });
    await run("recurring-generate", { through: "2026-03-31" });
    await run("recurring-generate", { through: "2026-03-31" });
    assert.equal(
      (
        await db.query<{ n: number }>(
          "SELECT count(*)::int n FROM obligations WHERE recurring_expense_id=$1",
          [rec.id],
        )
      ).rows[0].n,
      3,
    );
    await run("recurring-update", {
      id: rec.id,
      amount: "12.00",
      active: "CANCELLED",
      reason: "Cancelled test contract",
    });
    await run("recurring-generate", { through: "2026-05-31" });
    assert.equal(
      (
        await db.query<{ n: number }>(
          "SELECT count(*)::int n FROM obligations WHERE recurring_expense_id=$1",
          [rec.id],
        )
      ).rows[0].n,
      3,
    );
    await run("cost-calculate", {});
    const item = (
      await db.query<{
        id: string;
        order_id: string;
        quantity: number;
        product_id: string;
      }>("SELECT * FROM order_items WHERE product_id='jar' LIMIT 1")
    ).rows[0];
    const cost = (
      await db.query<{ id: string }>(
        "SELECT id FROM order_costs WHERE order_item_id=$1",
        [item.id],
      )
    ).rows[0];
    const invoice = await db.transaction((tx) =>
      postInvoice(
        tx,
        {
          vendor: "TEST",
          invoiceNumber: "TEST-OPS",
          entityId: "omurtak",
          storeId: "gia",
          currency: "USD",
          invoiceDate: "2026-10-06",
          effectiveDate: "2026-10-06",
          dueDate: "2026-10-08",
          total: "10.00",
          notes: "",
          confirmed: true,
          createRules: false,
          items: [
            {
              productId: "jar",
              bundles: 1,
              bundleQuantity: 2,
              product: "10.00",
              packaging: "0",
              fulfillment: "0",
              shipping: "0",
              other: "0",
            },
          ],
        },
        "demo-owner",
        "DEMO",
      ),
    );
    const line = (
      await db.query<{ id: string }>(
        "SELECT id FROM invoice_items WHERE invoice_id=$1",
        [invoice],
      )
    ).rows[0];
    await run("reconcile", {
      costId: cost.id,
      invoiceItemId: line.id,
      actual: "9.00",
      reason: "Reviewed invoice allocation",
    });
    await assert.rejects(
      run("reconcile", {
        costId: cost.id,
        invoiceItemId: line.id,
        actual: "11.00",
        reason: "invalid",
      }),
      /control total/,
    );
    await run("reconcile", {
      costId: cost.id,
      invoiceItemId: line.id,
      actual: "10.00",
      reason: "Corrected allocation",
    });
    assert.equal(
      (
        await db.query<{ n: number }>(
          "SELECT count(*)::int n FROM cost_reconciliations WHERE order_cost_id=$1",
          [cost.id],
        )
      ).rows[0].n,
      2,
    );
    const pool = await run("pool", {
      name: "TEST packaging",
      productId: "jar",
      quantity: String(item.quantity),
      amount: "100.00",
      component: "packaging",
      purchaseDate: "2026-10-01",
      dueDate: "2026-10-02",
    });
    await run("consume", {
      poolId: pool.id,
      itemId: item.id,
      quantity: String(item.quantity),
    });
    await assert.rejects(
      run("consume", {
        poolId: pool.id,
        itemId: item.id,
        quantity: String(item.quantity),
      }),
    );
    assert.equal(
      (
        await db.query<{ n: number }>(
          "SELECT remaining_quantity n FROM prepaid_cost_pools WHERE id=$1",
          [pool.id],
        )
      ).rows[0].n,
      0,
    );
    const supplier = await run("supplier", { name: "TEST supplier" }),
      sku = await run("supplier-sku", {
        supplierId: supplier.id,
        productId: "jar",
        sku: "TEST-SUP",
      }),
      wh = await run("warehouse", {
        name: "TEST US",
        country: "US",
        supplierId: supplier.id,
      });
    await run("stock", {
      supplierSkuId: sku.id,
      warehouseId: wh.id,
      available: "10",
      reserved: "2",
      onHand: "12",
      observedAt: new Date().toISOString(),
    });
    const ship = await run("shipment", {
      supplierSkuId: sku.id,
      warehouseId: wh.id,
      quantity: "20",
      eta: new Date(Date.now() + 86400000).toISOString(),
      status: "IN_TRANSIT",
      carrier: "TEST",
      tracking: "TEST-TRACK",
      cost: "0.00",
      dueDate: "2026-10-08",
    });
    await run("shipment-stage", { id: ship.id, status: "AVAILABLE" });
    await assert.rejects(
      run("shipment-stage", { id: ship.id, status: "AVAILABLE" }),
      /closed/,
    );
    assert.equal(
      (
        await db.query<{ available: number }>(
          "SELECT available FROM inventory_snapshots WHERE supplier_sku_id=$1 ORDER BY observed_at DESC LIMIT 1",
          [sku.id],
        )
      ).rows[0].available,
      30,
    );
    await run("payroll", {
      employee: "TEST employee",
      period: "2026-10",
      gross: "100.00",
      deductions: "20.00",
      employer: "10.00",
      payday: "2026-10-30",
      remittance: "2026-11-05",
    });
    await db.query(
      "INSERT INTO integration_connections(id,platform,store_id,status,config) VALUES('fixture-shopify','Shopify','gia','NOT_CONNECTED','{}')",
    );
    await run("entity-map", {
      effectiveStart: "2020-01-01",
      evidence: "Fictional test mapping",
    });
    const { ingestShopifyOrder } =
      await import("../src/lib/integrations/ingest");
    const connection = {
      id: "fixture-shopify",
      platform: "Shopify",
      store_id: "gia",
      config: { entityId: "omurtak", includeShipping: false },
      status: "NOT_CONNECTED",
      last_success_at: null,
    };
    const sourceOrder = {
      id: "gid://shopify/Order/fixture",
      name: "TEST-IMPORTED",
      createdAt: "2026-10-06T00:00:00Z",
      updatedAt: "2026-10-06T00:00:00Z",
      cancelledAt: null,
      subtotalPriceSet: { shopMoney: { amount: "10.00", currencyCode: "USD" } },
      totalDiscountsSet: { shopMoney: { amount: "2.00", currencyCode: "USD" } },
      totalShippingPriceSet: {
        shopMoney: { amount: "3.00", currencyCode: "USD" },
      },
      lineItems: {
        nodes: [
          {
            id: "gid://shopify/LineItem/fixture",
            quantity: 1,
            sku: "TEST-IMPORTED",
            variant: null,
          },
        ],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
      refunds: [],
    };
    await db.transaction((tx) =>
      ingestShopifyOrder(tx, connection, sourceOrder),
    );
    await db.transaction((tx) =>
      ingestShopifyOrder(tx, connection, sourceOrder),
    );
    assert.equal(
      (
        await db.query<{ n: number }>(
          "SELECT count(*)::int n FROM orders WHERE external_id=$1",
          [sourceOrder.id],
        )
      ).rows[0].n,
      1,
    );
    await assert.rejects(
      db.transaction((tx) =>
        ingestShopifyOrder(
          tx,
          { ...connection, config: { entityId: "softdance" } },
          sourceOrder,
        ),
      ),
      /mapping/,
    );
    const ops = await operationalWorkspace("gia", "USD", "omurtak", false);
    assert.equal(ops.tables.payroll.length, 0);
    assert.ok(!ops.tables.expenses.some((e) => e.category === "Payroll"));
    const owner = await operationalWorkspace("gia", "USD", "omurtak", true);
    assert.equal(owner.inventory[0].available, 30);
    assert.equal(owner.tables.payroll.length, 1);
    assert.throws(
      () =>
        parseOperation(
          {
            action: "payroll",
            storeId: "gia",
            entityId: "omurtak",
            currency: "USD",
            values: {},
          },
          { role: "OPERATIONS_MANAGER" },
        ),
      /Owner/,
    );
  } finally {
    global.companyOsDatabase = undefined;
    await engine.close();
  }
});
