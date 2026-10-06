import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { migrate, type Database } from "../src/lib/db";
import { seedDemo } from "../src/lib/seed";
import { postInvoice } from "../src/lib/invoices";
import {
  invoiceSchema,
  obligationSchema,
  attachmentType,
} from "../src/lib/validation";
const valid = {
  vendor: "Test supplier",
  invoiceNumber: "TEST-1",
  entityId: "omurtak",
  storeId: "gia",
  currency: "USD",
  invoiceDate: "2026-10-06",
  effectiveDate: "2026-10-06",
  dueDate: "2026-10-08",
  total: "11.00",
  notes: "",
  confirmed: true,
  createRules: false,
  items: [
    {
      productId: "jar",
      bundles: 2,
      bundleQuantity: 2,
      product: "5.50",
      packaging: "0",
      fulfillment: "0",
      shipping: "0",
      other: "0",
    },
  ],
};
test("migrations repeat safely and invoice posting is atomic, deduplicated and audited", async () => {
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
    await migrate(db);
    await seedDemo(db);
    await seedDemo(db);
    global.companyOsDatabase = Promise.resolve(db);
    const { workspace } = await import("../src/lib/workspace");
    const overview = await workspace("gia", "USD", 7);
    assert.ok(overview.metrics.profit !== null);
    assert.ok(overview.chart.at(-1)!.ads > 0);
    assert.ok(overview.chart.at(-1)!.cogs !== null);
    const empty = await workspace("faucet", "EUR", 7);
    assert.equal(empty.metrics.profit, null);
    assert.equal(empty.metrics.cogs, null);
    assert.equal(empty.metrics.ads, null);
    global.companyOsDatabase = undefined;
    const id = await db.transaction((tx) =>
      postInvoice(tx, valid, "demo-owner", "DEMO"),
    );
    const rows = await db.query<{ count: number }>(
      "SELECT count(*)::int as count FROM obligations WHERE invoice_id=$1",
      [id],
    );
    assert.equal(rows.rows[0].count, 1);
    await assert.rejects(
      db.transaction((tx) => postInvoice(tx, valid, "demo-owner", "DEMO")),
    );
    assert.equal(
      (
        await db.query<{ count: number }>(
          "SELECT count(*)::int as count FROM invoices",
        )
      ).rows[0].count,
      1,
    );
    await assert.rejects(
      db.transaction((tx) =>
        postInvoice(
          tx,
          { ...valid, invoiceNumber: "TEST-2", createRules: true },
          "demo-owner",
          "DEMO",
        ),
      ),
      /overlapping/,
    );
    assert.equal(
      (
        await db.query<{ count: number }>(
          "SELECT count(*)::int as count FROM invoices",
        )
      ).rows[0].count,
      1,
    );
    const audit = await db.query<{ count: number }>(
      "SELECT count(*)::int as count FROM audit_logs WHERE table_name='invoices' AND record_id=$1",
      [id],
    );
    assert.equal(audit.rows[0].count, 1);
    assert.equal(
      (
        await db.query<{ legal_entity_id: string | null }>(
          "SELECT legal_entity_id FROM stores WHERE id='gia'",
        )
      ).rows[0].legal_entity_id,
      null,
    );
  } finally {
    await engine.close();
  }
});
test("invoice mismatches, invalid dates, negative prices and unconfirmed extraction are rejected", () => {
  assert.equal(
    invoiceSchema.safeParse({ ...valid, total: "10.99" }).success,
    false,
  );
  assert.equal(
    invoiceSchema.safeParse({ ...valid, invoiceDate: "2026-02-30" }).success,
    false,
  );
  assert.equal(
    invoiceSchema.safeParse({ ...valid, confirmed: false }).success,
    false,
  );
  assert.equal(
    obligationSchema.safeParse({
      title: "x",
      entityId: "omurtak",
      storeId: "gia",
      currency: "USD",
      amount: "-10",
      dueDate: "2026-10-06",
      category: "VAT",
      scope: "COMPANY",
    }).success,
    false,
  );
});
test("attachment validation uses file signatures rather than extensions", () => {
  assert.equal(attachmentType(Buffer.from("<script>bad</script>")), null);
  assert.equal(attachmentType(Buffer.from("%PDF-1.7")), "application/pdf");
  assert.equal(
    attachmentType(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    "image/png",
  );
});
