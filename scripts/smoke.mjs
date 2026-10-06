import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const artifacts =
  process.env.SMOKE_ARTIFACTS_DIR || "/tmp/company-os-validation";
await mkdir(artifacts, { recursive: true });
(async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const url = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000";
  assert.equal(
    (await context.request.get(url + "/api/workspace")).status(),
    401,
  );
  assert.equal(
    (
      await context.request.post(url + "/api/session", {
        data: { demo: true },
        headers: { Origin: "https://evil.example" },
      })
    ).status(),
    403,
  );
  await page.goto(url);
  await page.getByRole("button", { name: "Enter demo workspace" }).click();
  await page
    .getByRole("heading", { name: "Your business. In focus." })
    .waitFor();
  await page.getByText("Performance, without the noise.").waitFor();
  assert.equal(
    (
      await context.request.post(url + "/api/obligations", {
        data: "x".repeat(70000),
        headers: { Origin: url, "Content-Type": "application/json" },
      })
    ).status(),
    413,
  );
  assert.equal(
    (
      await context.request.post(url + "/api/obligations", {
        data: "invalid-json",
        headers: { Origin: url, "Content-Type": "application/json" },
      })
    ).status(),
    400,
  );
  let response = await context.request.get(
    url + "/api/workspace?store=gia&currency=USD&days=7",
  );
  assert.equal(response.status(), 200);
  let data = await response.json();
  assert.ok(data.metrics.orders > 0);
  assert.ok(data.metrics.profit !== null);
  assert.equal(
    data.stores.find((s) => s.id === "gia").mapping_status,
    "UNMAPPED",
  );
  await page.screenshot({
    path: path.join(artifacts, "overview-yellow.png"),
    fullPage: true,
  });
  await page.selectOption("#store", "gia-usa");
  await page.getByText("Performance, without the noise.").waitFor();
  assert.equal(
    await page.evaluate(() =>
      getComputedStyle(document.querySelector(".app-shell"))
        .getPropertyValue("--accent")
        .trim(),
    ),
    "#877AF5",
  );
  await page.screenshot({
    path: path.join(artifacts, "overview-purple.png"),
    fullPage: true,
  });
  await page.selectOption("#store", "gia");
  await page.getByText("Performance, without the noise.").waitFor();
  await page
    .getByRole("button", { name: "Invoice center", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Upload invoice", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Supplier / vendor").fill("E2E Demo Supplier");
  const reference = "E2E-" + Date.now();
  await dialog.getByLabel("Invoice number").fill(reference);
  await dialog
    .getByLabel("Legal entity", { exact: true })
    .selectOption("omurtak");
  await dialog.getByLabel("Invoice total (USD)").fill("11.00");
  await dialog.getByLabel("Number of bundles").fill("2");
  await dialog.getByLabel("Product cost", { exact: true }).fill("5.50");
  await dialog.locator("input[type=file]").setInputFiles({
    name: "demo-invoice.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV7sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await dialog.getByLabel("I reviewed the dates", { exact: false }).check();
  await dialog.getByRole("button", { name: "Confirm invoice" }).click();
  await page.getByText(reference, { exact: false }).waitFor();
  await page.reload();
  await page.getByText("Performance, without the noise.").waitFor();
  await page
    .getByRole("button", { name: "Invoice center", exact: true })
    .click();
  await page.getByText(reference, { exact: false }).waitFor();
  const after = await (
    await context.request.get(
      url + "/api/workspace?store=gia&currency=USD&days=7",
    )
  ).json();
  const inv = after.invoices.find((i) => i.invoice_number === reference);
  assert.ok(inv && inv.attachment_id);
  assert.equal(
    (
      await context.request.get(url + "/api/attachments/" + inv.attachment_id)
    ).status(),
    200,
  );
  assert.equal(
    after.obligations.filter((o) => o.title.includes(reference)).length,
    1,
  );
  await page
    .getByRole("button", { name: "Cash & obligations", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add obligation", exact: true })
    .first()
    .click();
  const obligation = page.getByRole("dialog");
  await obligation.getByLabel("Description").fill("E2E personal owner tax");
  await obligation
    .getByLabel("Category", { exact: true })
    .selectOption("Owner Tax");
  await obligation
    .getByLabel("Legal entity", { exact: true })
    .selectOption("omurtak");
  await obligation.getByLabel("Scope").selectOption("PERSONAL");
  await obligation.getByLabel("Amount (USD)").fill("100.00");
  await obligation.getByRole("button", { name: "Save obligation" }).click();
  await page.getByText("E2E personal owner tax", { exact: true }).waitFor();
  const record = page.locator("tr").filter({ hasText: reference });
  await record.getByRole("button", { name: "Record paid" }).click();
  await page.getByRole("button", { name: "Confirm payment record" }).click();
  await record.getByText("Paid", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Record balance" }).click();
  const balance = page.getByRole("dialog");
  await balance
    .getByLabel("Legal entity", { exact: true })
    .selectOption("omurtak");
  await balance.getByLabel("Account name").fill("DEMO operating account");
  await balance.getByLabel("Available balance (USD)").fill("245989.00");
  await balance.getByRole("button", { name: "Save balance snapshot" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "New balance snapshot saved" })
    .waitFor();
  await page
    .getByRole("button", { name: "Can we scale?", exact: true })
    .click();
  await page.getByLabel("Proposed Meta spend / day").fill("70000");
  await page.getByRole("button", { name: "Calculate scenario" }).click();
  await page.getByText("INCOMPLETE INPUTS", { exact: false }).waitFor();
  await page.screenshot({
    path: path.join(artifacts, "scenario.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Inventory & supply", exact: true })
    .click();
  await page.getByRole("heading", { name: "Inventory coverage" }).waitFor();
  await page.getByRole("button", { name: "Connections", exact: true }).click();
  await page
    .getByRole("button", { name: "Configure Shopify", exact: true })
    .waitFor();
  await page.selectOption("#store", "faucet");
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.getByText("Performance, without the noise.").waitFor();
  await page.selectOption("#store", "gia");
  await page.getByText("Performance, without the noise.").waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: path.join(artifacts, "mobile.png"),
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page
    .getByRole("button", { name: "Invoice center", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "From invoice to insight." })
    .waitFor();
  const ops = await browser.newContext();
  const auth = await ops.request.post(url + "/api/session", {
    data: {
      email: "ops-test@company-os.local",
      password: "test-only-not-a-real-password",
    },
    headers: { Origin: url },
  });
  assert.equal(auth.status(), 200);
  const opsView = await (
    await ops.request.get(url + "/api/workspace?store=gia&currency=USD&days=7")
  ).json();
  assert.equal(
    opsView.obligations.some(
      (o) => o.scope === "PERSONAL" || o.category === "Payroll",
    ),
    false,
  );
  assert.equal(
    (
      await ops.request.post(url + "/api/balances", {
        data: {},
        headers: { Origin: url },
      })
    ).status(),
    403,
  );
  assert.equal(
    (
      await ops.request.post(url + "/api/obligations", {
        data: {
          title: "Private tax",
          entityId: "omurtak",
          storeId: "gia",
          currency: "USD",
          amount: "1.00",
          dueDate: "2026-10-06",
          category: "Owner Tax",
          scope: "PERSONAL",
        },
        headers: { Origin: url },
      })
    ).status(),
    403,
  );
  const wrong = await browser.newContext();
  assert.equal(
    (
      await wrong.request.post(url + "/api/session", {
        data: {
          email: "ops-test@company-os.local",
          password: "wrong-password",
        },
        headers: { Origin: url },
      })
    ).status(),
    401,
  );
  assert.deepEqual(errors, []);
  await browser.close();
  console.log(
    "PASS: auth boundaries, both themes, invoice upload/confirmation/reload/download, personal obligations, payment recording, balance snapshots, scaling, inventory and mobile navigation.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
