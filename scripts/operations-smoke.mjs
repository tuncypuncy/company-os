import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const url = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000";
const artifacts =
  process.env.SMOKE_ARTIFACTS_DIR || "/tmp/company-os-validation";
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
    }),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await page.getByRole("button", { name: "Enter demo workspace" }).click();
  await page
    .getByRole("heading", { name: "Your business. In focus." })
    .waitFor();
  const stamp = Date.now();
  const request = async (action, values) => {
    const r = await context.request.post(url + "/api/operations", {
      headers: { Origin: url },
      data: {
        action,
        storeId: "gia",
        entityId: "omurtak",
        currency: "USD",
        values,
      },
    });
    const body = await r.json();
    assert.equal(r.status(), 201, JSON.stringify(body));
    return body;
  };
  async function nav(name) {
    await page.getByRole("button", { name, exact: true }).click();
  }
  await nav("Expenses & payroll");
  await page
    .getByRole("button", { name: "Add subscription", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Responsible legal entity").selectOption("omurtak");
  await dialog
    .getByLabel("App / vendor")
    .fill("DEMO TEST subscription " + stamp);
  await dialog.getByLabel("Category", { exact: true }).fill("SaaS");
  await dialog.getByLabel("Current price").fill("12.34");
  await dialog.getByRole("button", { name: "Confirm & save" }).click();
  await page.getByRole("status").filter({ hasText: "Record saved" }).waitFor();
  await page
    .getByRole("button", {
      name: "Applications & recurring contracts",
      exact: true,
    })
    .click();
  await page
    .getByRole("cell", { name: "DEMO TEST subscription " + stamp, exact: true })
    .waitFor();
  await page.getByRole("button", { name: "View source" }).first().click();
  await page
    .getByRole("heading", { name: "Source evidence & calculation lineage" })
    .waitFor();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await request("recurring-generate", {
    through: new Date().toISOString().slice(0, 10),
  });
  await request("settings", {
    buffer: "80000.00",
    watch: "14",
    critical: "3",
    metaWatch: "3",
    freshness: "24",
    refundPolicy: "INTERNAL_REVIEWED",
  });
  const supplier = await request("supplier", {
      name: "DEMO TEST supplier " + stamp,
    }),
    sku = await request("supplier-sku", {
      supplierId: supplier.id,
      productId: "jar",
      sku: "DEMO TEST SUP " + stamp,
    }),
    warehouse = await request("warehouse", {
      supplierId: supplier.id,
      name: "DEMO TEST warehouse " + stamp,
      country: "US",
    });
  await request("stock", {
    supplierSkuId: sku.id,
    warehouseId: warehouse.id,
    available: "10",
    reserved: "2",
    onHand: "12",
    observedAt: new Date().toISOString(),
  });
  const shipment = await request("shipment", {
    supplierSkuId: sku.id,
    warehouseId: warehouse.id,
    quantity: "20",
    eta: new Date(Date.now() + 3 * 86400000).toISOString(),
    status: "IN_TRANSIT",
    carrier: "DEMO TEST",
    tracking: "TEST-" + stamp,
    cost: "0.00",
    dueDate: new Date().toISOString().slice(0, 10),
  });
  await request("shipment-stage", { id: shipment.id, status: "AVAILABLE" });
  const duplicate = await context.request.post(url + "/api/operations", {
    headers: { Origin: url },
    data: {
      action: "shipment-stage",
      storeId: "gia",
      entityId: "omurtak",
      currency: "USD",
      values: { id: shipment.id, status: "AVAILABLE" },
    },
  });
  assert.equal(duplicate.status(), 409);
  await nav("Inventory & supply");
  await page
    .getByRole("heading", { name: "Inventory coverage", exact: true })
    .waitFor();
  await page
    .getByText("DEMO TEST warehouse " + stamp + " · US", { exact: true })
    .waitFor();
  await page.getByLabel("US warehouses").check();
  await page
    .getByRole("button", { name: "Inbound supply chain", exact: true })
    .click();
  await page
    .getByRole("cell", { name: "TEST-" + stamp, exact: true })
    .waitFor();
  await page.screenshot({
    path: artifacts + "/inventory-control.png",
    fullPage: true,
  });
  await nav("Cash & obligations");
  await page
    .getByRole("heading", { name: "Expected settlements", exact: true })
    .waitFor();
  await page
    .getByRole("heading", { name: "Cash translation & FX lineage" })
    .waitFor();
  const expense = await request("expense", {
    vendor: "DEMO TEST paid " + stamp,
    category: "SaaS",
    amount: "100.00",
    recognizedDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date().toISOString().slice(0, 10),
    recognition: "OPERATING",
    notes: "Fictional test evidence",
  });
  const sourcePage = await context.newPage();
  await sourcePage.setContent(
    '<html><body style="font:32px Arial;padding:40px"><h1>Fictional Test Supplier</h1><p>Invoice INV-TEST-123</p><p>Total USD 100.00</p></body></html>',
  );
  const receipt = await sourcePage.pdf({ format: "A4" });
  const png = await sourcePage.screenshot();
  await sourcePage.setContent(
    `<img src="data:image/png;base64,${png.toString("base64")}" style="width:100%">`,
  );
  const scannedPdf = await sourcePage.pdf({ format: "A4" });
  for (const [bytes, type] of [
    [receipt, "application/pdf"],
    [png, "image/png"],
    [scannedPdf, "application/pdf"],
  ]) {
    const extracted = await context.request.post(url + "/api/extraction", {
      headers: { Origin: url, "Content-Type": type },
      data: bytes,
    });
    assert.equal(extracted.status(), 200);
    const proposal = await extracted.json();
    assert.equal(proposal.status, "UNREVIEWED");
    assert.ok(
      proposal.totalCandidates.includes("100.00"),
      JSON.stringify(proposal),
    );
  }
  const uploadReceipt = () =>
    context.request.post(url + "/api/receipts", {
      headers: { Origin: url },
      multipart: {
        expenseId: expense.id,
        confirmed: "true",
        file: {
          name: "fictional-receipt.pdf",
          mimeType: "application/pdf",
          buffer: receipt,
        },
      },
    });
  await nav("Expenses & payroll");
  await page
    .getByPlaceholder("Search records…")
    .fill("DEMO TEST paid " + stamp);
  const expenseRow = page.getByRole("row").filter({
    has: page.getByRole("cell", {
      name: "DEMO TEST paid " + stamp,
      exact: true,
    }),
  });
  await expenseRow.getByRole("button", { name: "View source" }).click();
  const receiptDialog = page.getByRole("dialog");
  await receiptDialog.getByLabel("Receipt file").setInputFiles({
    name: "fictional-receipt.pdf",
    mimeType: "application/pdf",
    buffer: receipt,
  });
  await receiptDialog.getByRole("checkbox").check();
  await receiptDialog
    .getByRole("button", { name: "Attach reviewed receipt" })
    .click();
  const download = receiptDialog.getByRole("link", {
    name: "Download fictional-receipt.pdf",
  });
  await download.waitFor();
  const href = await download.getAttribute("href");
  assert.equal((await context.request.get(url + href)).status(), 200);
  await page.getByRole("button", { name: "Close dialog" }).click();
  assert.equal((await uploadReceipt()).status(), 409);
  await sourcePage.close();
  const op = await (
    await context.request.get(url + "/api/operations?store=gia&currency=USD")
  ).json();
  const obligation = op.lookups.obligations.find(
    (o) => o.name === "DEMO TEST paid " + stamp,
  );
  assert.ok(obligation);
  await request("payment", {
    obligationId: obligation.id,
    amount: "40.00",
    paidAt: new Date().toISOString(),
    reference: "TEST-PARTIAL-" + stamp,
  });
  const workspace = await (
    await context.request.get(
      url + "/api/workspace?store=gia&currency=USD&days=7",
    )
  ).json();
  assert.equal(
    Number(
      workspace.obligations.find((o) => o.id === obligation.id).amount_minor,
    ),
    6000,
  );
  await nav("Can we scale?");
  await page.getByLabel("Proposed Meta spend / day").fill("70000");
  await page
    .getByRole("button", { name: "Calculate scenario", exact: true })
    .click();
  await page
    .getByText(/INCOMPLETE INPUTS|DO NOT SCALE|SCENARIO SUPPORTED/)
    .first()
    .waitFor();
  await page
    .getByRole("button", { name: "Save scenario", exact: true })
    .click();
  await page.getByRole("heading", { name: "Saved scenario history" }).waitFor();
  await nav("Connections");
  await page
    .getByRole("button", { name: "Configure Shopify", exact: true })
    .click();
  const config = page.getByRole("dialog");
  await config.getByLabel("Responsible entity").selectOption("omurtak");
  await config
    .getByLabel("Exact *.myshopify.com identity")
    .fill("fixture-" + stamp + ".myshopify.com");
  await config
    .getByLabel("Server-side access-token variable")
    .fill("SHOPIFY_FIXTURE_MISSING_TOKEN");
  await config.getByRole("button", { name: "Save as not connected" }).click();
  await page
    .getByText("fixture-" + stamp + ".myshopify.com", { exact: true })
    .waitFor();
  const card = page.locator("section").filter({
    has: page.getByRole("heading", {
      name: "fixture-" + stamp + ".myshopify.com",
      exact: true,
    }),
  });
  await card.getByRole("button", { name: "Verify access" }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "SHOPIFY_FIXTURE_MISSING_TOKEN is not configured" })
    .waitFor();
  await nav("Audit & lineage");
  await page
    .getByRole("heading", { name: "Append-only change history" })
    .waitFor();
  await page.locator(".audit-list details").first().waitFor();
  await nav("Overview");
  await page.selectOption("#store", "all");
  await page.getByText("Performance, without the noise.").waitFor();
  const grouped = await (
    await context.request.get(
      url + "/api/workspace?store=all&currency=USD&days=7",
    )
  ).json();
  assert.equal(grouped.storeId, "all");
  assert.ok(grouped.metrics.orders > 0);
  await page.getByLabel("Brand", { exact: true }).selectOption("360-faucet");
  await page.getByText("Group totals use USD only.").waitFor();
  await page.selectOption("#store", "gia-usa");
  await page.getByText("Performance, without the noise.").waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: artifacts + "/operations-mobile.png",
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: subscriptions, recurring liabilities, record lineage, stock receipts/deduplication, US filtering, partial payments, FX, saved combined scenarios, missing-credential connection controls, audits, group/brand reports and mobile layout.",
  );
} finally {
  await browser.close();
}
