export function minor(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value))
    throw new Error("Use a positive amount with at most two decimals");
  const [whole, fraction = ""] = value.split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(result)) throw new Error("Amount is too large");
  return result;
}
export function integer(value: unknown): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result))
    throw new Error("Invalid minor-unit amount");
  return result;
}
function sum(values: number[]) {
  const result = values.reduce((a, b) => a + b, 0);
  if (!Number.isSafeInteger(result)) throw new Error("Amount overflow");
  return result;
}
export type CostRule = {
  id: string;
  product_id: string;
  store_id: string;
  legal_entity_id: string;
  bundle_quantity: number;
  currency: string;
  product_minor: number;
  packaging_minor: number;
  fulfillment_minor: number;
  shipping_minor: number;
  other_minor: number;
  effective_start: string;
  effective_end: string | null;
  version: number;
  status: string;
};
export function orderCost(
  rules: CostRule[],
  input: {
    productId: string;
    storeId: string;
    entityId: string;
    quantity: number;
    bundleQuantity: number;
    date: string;
    currency: string;
  },
) {
  if (
    !Number.isInteger(input.quantity) ||
    input.quantity <= 0 ||
    input.quantity % input.bundleQuantity !== 0
  )
    throw new Error("Quantity must be an exact multiple of the bundle size");
  const matches = rules.filter(
    (r) =>
      r.product_id === input.productId &&
      r.store_id === input.storeId &&
      r.legal_entity_id === input.entityId &&
      r.bundle_quantity === input.bundleQuantity &&
      r.currency === input.currency &&
      r.effective_start <= input.date &&
      (!r.effective_end || input.date < r.effective_end),
  );
  if (matches.length !== 1)
    return {
      status: matches.length ? "AMBIGUOUS" : "UNMAPPED",
      total: null,
      ruleId: null,
    } as const;
  const r = matches[0];
  const units = input.quantity / input.bundleQuantity;
  const total = sum(
    [
      r.product_minor,
      r.packaging_minor,
      r.fulfillment_minor,
      r.shipping_minor,
      r.other_minor,
    ].map(integer),
  );
  return {
    status: r.status,
    total: sum([total * units]),
    ruleId: r.id,
    version: r.version,
  };
}
export function profitability(input: {
  gross: number;
  discounts: number;
  refunds: number;
  cogs: number | null;
  ads: number;
  fees: number;
}) {
  const net = sum([input.gross, -input.discounts, -input.refunds]);
  const profit =
    input.cogs === null
      ? null
      : sum([net, -input.cogs, -input.ads, -input.fees]);
  return {
    net,
    profit,
    margin: net === 0 || profit === null ? null : profit / net,
  };
}
export type CashEvent = {
  id: string;
  amount: number;
  currency: string;
  entityId: string;
  dueAt: string;
  status: string;
  scope?: string;
};
export function cashForecast(input: {
  opening: number;
  buffer: number;
  currency: string;
  asOf: string;
  hours: number;
  outflows: CashEvent[];
  inflows: CashEvent[];
  entityId?: string;
}) {
  const start = Date.parse(input.asOf),
    end = start + input.hours * 3600000;
  if (!Number.isFinite(start) || !Number.isFinite(end) || input.hours <= 0)
    throw new Error("Invalid forecast horizon");
  const select = (events: CashEvent[], outgoing: boolean) => {
    const seen = new Map<string, CashEvent>();
    for (const e of events) {
      if (
        seen.has(e.id) &&
        JSON.stringify(seen.get(e.id)) !== JSON.stringify(e)
      )
        throw new Error("Conflicting duplicate cash event");
      seen.set(e.id, e);
    }
    return [...seen.values()].filter(
      (e) =>
        e.currency === input.currency &&
        (!input.entityId || e.entityId === input.entityId) &&
        e.scope !== "PERSONAL" &&
        (outgoing
          ? e.status === "SCHEDULED"
          : e.status === "ESTIMATED" || e.status === "CONFIRMED") &&
        Date.parse(e.dueAt) <= end &&
        (outgoing || Date.parse(e.dueAt) >= start),
    );
  };
  const outgoing = sum(
      select(input.outflows, true).map((e) => integer(e.amount)),
    ),
    incoming = sum(select(input.inflows, false).map((e) => integer(e.amount)));
  const ending = sum([input.opening, incoming, -outgoing]);
  return {
    hours: input.hours,
    outgoing,
    incoming,
    ending,
    buffer: input.buffer,
    surplus: ending - input.buffer,
    fundingNeeded: Math.max(0, input.buffer - ending),
  };
}
export function metaHeadroom(limit: number, debt: number, dailySpend: number) {
  if (limit <= 0) return { available: null, utilization: null, days: null };
  const available = limit - debt;
  return {
    available,
    utilization: debt / limit,
    days: dailySpend > 0 ? Math.max(0, available) / dailySpend : null,
  };
}
export function scaleScenario(input: {
  currentDaily: number;
  proposedDaily: number;
  roas: number;
  cogsBps: number;
  refundBps: number;
  feeBps: number;
  availableCredit: number;
  settlementDays: number;
  availableUnits: number | null;
  dailyUnits: number | null;
}) {
  if (
    !Number.isSafeInteger(input.currentDaily) ||
    !Number.isSafeInteger(input.proposedDaily) ||
    input.currentDaily < 0 ||
    input.proposedDaily < 0 ||
    !Number.isFinite(input.roas) ||
    input.roas < 0 ||
    !Number.isFinite(input.settlementDays) ||
    input.settlementDays < 0
  )
    throw new Error("Invalid scenario");
  for (const rate of [input.cogsBps, input.refundBps, input.feeBps])
    if (!Number.isInteger(rate) || rate < 0 || rate > 10000)
      throw new Error("Invalid rate");
  const revenue = Math.round(input.proposedDaily * input.roas),
    cogs = Math.round((revenue * input.cogsBps) / 10000),
    refunds = Math.round((revenue * input.refundBps) / 10000),
    fees = Math.round((revenue * input.feeBps) / 10000);
  const baselineRevenue = Math.round(input.currentDaily * input.roas);
  const dailyUnits =
    input.currentDaily > 0 && input.dailyUnits !== null
      ? (input.dailyUnits * input.proposedDaily) / input.currentDaily
      : null;
  return {
    revenue,
    cogs,
    refunds,
    fees,
    profit: sum([revenue, -cogs, -refunds, -fees, -input.proposedDaily]),
    headroom:
      input.proposedDaily > 0
        ? Math.max(0, input.availableCredit) / input.proposedDaily
        : null,
    dailyUnits,
    daysStock:
      dailyUnits && input.availableUnits !== null
        ? input.availableUnits / dailyUnits
        : null,
    horizons: [24, 48, 72, 168].map((hours) => {
      const days = hours / 24;
      return {
        hours,
        incrementalAccruedSpend: Math.round(
          (input.proposedDaily - input.currentDaily) * days,
        ),
        incrementalEstimatedSettlements: Math.round(
          (revenue - baselineRevenue) *
            Math.max(0, days - input.settlementDays),
        ),
        cashRequired: null,
      };
    }),
  };
}
