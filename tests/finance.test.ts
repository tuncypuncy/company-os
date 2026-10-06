import { test } from "node:test";
import assert from "node:assert/strict";
import {
  minor,
  orderCost,
  cashForecast,
  profitability,
  metaHeadroom,
  scaleScenario,
  type CostRule,
  type CashEvent,
} from "../src/lib/finance";
const base: CostRule = {
  id: "old",
  product_id: "jar",
  store_id: "store",
  legal_entity_id: "entity",
  bundle_quantity: 2,
  currency: "USD",
  product_minor: 550,
  packaging_minor: 17,
  fulfillment_minor: 30,
  shipping_minor: 100,
  other_minor: 0,
  effective_start: "2026-01-01",
  effective_end: "2026-09-01",
  version: 1,
  status: "CONFIRMED",
};
const input = {
  productId: "jar",
  storeId: "store",
  entityId: "entity",
  quantity: 4,
  bundleQuantity: 2,
  date: "2026-07-01",
  currency: "USD",
};
test("decimal money is exact and malformed or unsafe inputs are rejected", () => {
  assert.equal(minor("0.17"), 17);
  assert.equal(minor("85.01"), 8501);
  for (const n of ["-1", "1e3", "0.001", "NaN", "9007199254740992"])
    assert.throws(() => minor(n));
});
test("bundle pricing is nonlinear, component costs deducted exactly once", () => {
  assert.equal(orderCost([base], input).total, 1394);
  const p = profitability({
    gross: 5000,
    discounts: 100,
    refunds: 200,
    cogs: 1394,
    fees: 100,
    ads: 1000,
  });
  assert.equal(p.net, 4700);
  assert.equal(p.profit, 2206);
});
test("historical rule selection uses an exclusive end and does not rewrite prior orders", () => {
  const newer = {
    ...base,
    id: "new",
    effective_start: "2026-09-01",
    effective_end: null,
    product_minor: 520,
    version: 2,
  };
  assert.equal(orderCost([base, newer], input).ruleId, "old");
  assert.equal(
    orderCost([base, newer], { ...input, date: "2026-09-01" }).ruleId,
    "new",
  );
  assert.equal(base.product_minor, 550);
});
test("missing or ambiguous cost rules cannot produce a false zero", () => {
  assert.equal(orderCost([], input).total, null);
  assert.equal(
    orderCost([base, { ...base, id: "overlap" }], input).status,
    "AMBIGUOUS",
  );
  assert.throws(() => orderCost([base], { ...input, quantity: 3 }));
  assert.equal(
    profitability({
      gross: 0,
      discounts: 0,
      refunds: 0,
      cogs: null,
      ads: 0,
      fees: 0,
    }).profit,
    null,
  );
});
const event = (
  id: string,
  amount: number,
  hours: number,
  overrides: Partial<CashEvent> = {},
): CashEvent => ({
  id,
  amount,
  currency: "USD",
  entityId: "entity",
  dueAt: new Date(
    Date.parse("2026-10-06T00:00:00Z") + hours * 3600000,
  ).toISOString(),
  status: "SCHEDULED",
  ...overrides,
});
const forecast = {
  opening: 10000,
  buffer: 2000,
  currency: "USD",
  asOf: "2026-10-06T00:00:00Z",
  hours: 24,
  entityId: "entity",
};
test("rolling cash boundaries, overdue debt, duplicate IDs, settled and personal obligations", () => {
  const due = event("due", 3000, 24);
  const f = cashForecast({
    ...forecast,
    outflows: [
      due,
      due,
      event("late", 1000, -1),
      event("later", 4000, 25),
      event("paid", 500, 12, { status: "PAID" }),
      event("personal", 1000, 12, { scope: "PERSONAL" }),
      event("other-currency", 999, 12, { currency: "EUR" }),
      event("other-entity", 999, 12, { entityId: "other" }),
    ],
    inflows: [event("in", 2000, 20, { status: "CONFIRMED" })],
  });
  assert.equal(f.outgoing, 4000);
  assert.equal(f.incoming, 2000);
  assert.equal(f.ending, 8000);
  assert.equal(f.fundingNeeded, 0);
  assert.throws(() =>
    cashForecast({
      ...forecast,
      outflows: [due, { ...due, amount: 9 }],
      inflows: [],
    }),
  );
});
test("cash shortfall is distinguished from gross outgoing", () => {
  const f = cashForecast({
    ...forecast,
    outflows: [event("large", 12000, 10)],
    inflows: [],
  });
  assert.equal(f.outgoing, 12000);
  assert.equal(f.ending, -2000);
  assert.equal(f.fundingNeeded, 4000);
});
test("Meta zero spend, exhausted limit and missing credit do not divide by zero", () => {
  assert.equal(metaHeadroom(40000, 29600, 4000).days, 2.6);
  assert.equal(metaHeadroom(0, 0, 4000).days, null);
  assert.equal(metaHeadroom(40000, 45000, 1000).days, 0);
  assert.equal(metaHeadroom(40000, 0, 0).days, null);
});
test("scaling keeps ad accrual separate from cash and respects settlement delay", () => {
  const s = scaleScenario({
    currentDaily: 3000000,
    proposedDaily: 5000000,
    roas: 3,
    cogsBps: 2500,
    refundBps: 200,
    feeBps: 350,
    availableCredit: 10000000,
    settlementDays: 3,
    availableUnits: null,
    dailyUnits: null,
  });
  assert.equal(s.horizons[0].incrementalAccruedSpend, 2000000);
  assert.equal(s.horizons[0].incrementalEstimatedSettlements, 0);
  assert.equal(s.horizons[0].cashRequired, null);
  assert.equal(s.headroom, 2);
  assert.equal(s.daysStock, null);
  assert.equal(s.profit, 5425000);
});
