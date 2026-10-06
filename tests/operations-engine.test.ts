import { test } from "node:test";
import assert from "node:assert/strict";
import {
  nextOccurrence,
  prepaidAllocation,
  bomDemand,
  stockForecast,
  earlyPayment,
} from "../src/lib/operations-engine";
import { orderCost, type CostRule } from "../src/lib/finance";
test("month-end recurrence retains its anchor through February and leap years", () => {
  assert.equal(nextOccurrence("2026-01-31", "MONTHLY", 31), "2026-02-28");
  assert.equal(nextOccurrence("2026-02-28", "MONTHLY", 31), "2026-03-31");
  assert.equal(nextOccurrence("2023-02-28", "YEARLY", 29), "2024-02-29");
});
test("prepaid cumulative rounding exhausts exactly and rejects overdrafts", () => {
  assert.equal(
    prepaidAllocation(100, 3, 3, 1) +
      prepaidAllocation(100, 3, 2, 1) +
      prepaidAllocation(100, 3, 1, 1),
    100,
  );
  assert.throws(() => prepaidAllocation(100, 3, 1, 2));
});
test("nested BOM demand is physical and cycles fail closed", () => {
  const bom = [
    { bundle_variant_id: "bundle", component_variant_id: "jar", quantity: 2 },
    { bundle_variant_id: "bundle", component_variant_id: "box", quantity: 1 },
  ];
  assert.deepEqual(bomDemand("bundle", 3, bom), { jar: 6, box: 3 });
  assert.throws(
    () =>
      bomDemand("bundle", 1, [
        ...bom,
        {
          bundle_variant_id: "jar",
          component_variant_id: "bundle",
          quantity: 1,
        },
      ]),
    /Circular/,
  );
});
test("inbound cannot mask a stockout before arrival or become opening stock", () => {
  const f = stockForecast(
    20,
    10,
    [{ quantity: 100, eta: "2026-10-04T00:00:00Z", status: "IN_TRANSIT" }],
    "2026-10-01T00:00:00Z",
  );
  assert.equal(f.days, 2);
  assert.equal(f.stockoutBeforeInbound, true);
  assert.equal(f.stockoutAt, "2026-10-03T00:00:00.000Z");
  assert.equal(stockForecast(0, 0, [], "2026-10-01").stockoutAt, null);
  assert.equal(stockForecast(10, null, [], "2026-10-01").risk, "UNKNOWN");
});
test("early payment recommendation respects clearing time, cash buffer and missing inputs", () => {
  assert.equal(
    earlyPayment({
      credit: 50,
      dailySpend: 100,
      clearingDays: 2,
      freeCash: 1000,
      buffer: 100,
      otherOutflows: 100,
    }).amount,
    250,
  );
  assert.equal(
    earlyPayment({
      credit: 50,
      dailySpend: 100,
      clearingDays: 2,
      freeCash: 200,
      buffer: 100,
      otherOutflows: 100,
    }).status,
    "CASH_CONSTRAINED",
  );
  assert.equal(
    earlyPayment({
      credit: null,
      dailySpend: 100,
      clearingDays: 2,
      freeCash: 1000,
      buffer: 100,
      otherOutflows: 100,
    }).status,
    "UNKNOWN",
  );
});

test("combined scale decision blocks unknown routing and distinguishes credit accrual from cash funding", async () => {
  const { scaleDecision } = await import("../src/lib/scale-decision");
  const base = {
    currentDaily: 100,
    proposedDaily: 200,
    roas: 3,
    cogsBps: 2000,
    refundBps: 0,
    feeBps: 0,
    settlementDays: 2,
    opening: 10000,
    buffer: 100,
    availableCredit: 1000,
    clearingDays: 1,
    paymentMode: "CREDIT" as const,
    asOf: "2026-10-01T00:00:00Z",
    currency: "USD",
    outflows: [],
    inflows: [],
    inventory: [
      { sku: "jar", available: 100, daily: 10, inbound: [], fresh: true },
    ],
    coverageComplete: false,
    cashFresh: true,
    metaFresh: true,
    supplierCashBps: 0,
  };
  const result = scaleDecision(base);
  assert.equal(result.horizons[0].additionalOutflow, 0);
  assert.equal(result.risks.overall, "INCOMPLETE_INPUTS");
  assert.equal(result.inventory[0].forecast.days, 5);
  const constrained = scaleDecision({
    ...base,
    opening: 0,
    paymentMode: "DAILY_CASH",
    coverageComplete: true,
  });
  assert.equal(constrained.risks.overall, "DO_NOT_SCALE");
  assert.equal(constrained.horizons[0].additionalOutflow, 100);
});
