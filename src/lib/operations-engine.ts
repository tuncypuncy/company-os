export function nextOccurrence(
  date: string,
  frequency: string,
  anchor = Number(date.slice(8, 10)),
) {
  const value = new Date(date + "T00:00:00Z");
  if (!Number.isFinite(value.getTime()))
    throw new Error("Invalid recurrence date");
  if (frequency === "WEEKLY") value.setUTCDate(value.getUTCDate() + 7);
  else if (frequency === "DAILY") value.setUTCDate(value.getUTCDate() + 1);
  else {
    const months = { MONTHLY: 1, QUARTERLY: 3, YEARLY: 12 }[frequency];
    if (!months) throw new Error("Invalid billing frequency");
    value.setUTCDate(1);
    value.setUTCMonth(value.getUTCMonth() + months);
    const last = new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0),
    ).getUTCDate();
    value.setUTCDate(Math.min(anchor, last));
  }
  return value.toISOString().slice(0, 10);
}
export function prepaidAllocation(
  total: number,
  purchased: number,
  remaining: number,
  consume: number,
) {
  if (
    ![total, purchased, remaining, consume].every(Number.isSafeInteger) ||
    total <= 0 ||
    purchased <= 0 ||
    consume <= 0 ||
    remaining < consume ||
    remaining > purchased
  )
    throw new Error("Invalid or exhausted prepaid pool");
  // Cumulative rounded allocation ensures final consumption exhausts exactly the original value.
  const before = purchased - remaining;
  return (
    Math.round((total * (before + consume)) / purchased) -
    Math.round((total * before) / purchased)
  );
}
export type Inbound = { quantity: number; eta: string; status: string };
export function stockForecast(
  available: number | null,
  daily: number | null,
  inbound: Inbound[],
  asOf: string,
  watch = 14,
  critical = 3,
) {
  if (available !== null && (!Number.isInteger(available) || available < 0))
    throw new Error("Invalid inventory");
  if (daily !== null && (!Number.isFinite(daily) || daily < 0))
    throw new Error("Invalid velocity");
  if (available === null || daily === null)
    return {
      days: null,
      stockoutAt: null,
      risk: "UNKNOWN",
      arrivals: [] as {
        eta: string;
        balanceBefore: number;
        quantity: number;
      }[],
      stockoutBeforeInbound: false,
    };
  const days = daily > 0 ? available / daily : null;
  let balance = available,
    at = Date.parse(asOf),
    stockout: number | null = null;
  const arrivals = [] as {
    eta: string;
    balanceBefore: number;
    quantity: number;
  }[];
  for (const event of inbound
    .filter((i) => !["CANCELLED", "AVAILABLE"].includes(i.status))
    .sort((a, b) => Date.parse(a.eta) - Date.parse(b.eta))) {
    const eta = Date.parse(event.eta);
    if (!Number.isFinite(eta) || eta < at) continue;
    const consumed = (daily * (eta - at)) / 86400000;
    if (daily > 0 && balance < consumed && stockout === null)
      stockout = at + (balance / daily) * 86400000;
    balance -= consumed;
    arrivals.push({
      eta: event.eta,
      balanceBefore: balance,
      quantity: event.quantity,
    });
    balance = Math.max(0, balance) + event.quantity;
    at = eta;
  }
  if (stockout === null && daily > 0)
    stockout = at + (balance / daily) * 86400000;
  return {
    days,
    stockoutAt: stockout === null ? null : new Date(stockout).toISOString(),
    risk:
      days === null
        ? "NO_DEMAND"
        : days <= critical
          ? "CRITICAL"
          : days <= watch
            ? "WATCH"
            : "HEALTHY",
    arrivals,
    stockoutBeforeInbound: arrivals.some((a) => a.balanceBefore < 0),
  };
}
export function bomDemand(
  variant: string,
  bundles: number,
  components: {
    bundle_variant_id: string;
    component_variant_id: string;
    quantity: number;
  }[],
  trail: string[] = [],
): Record<string, number> {
  if (trail.includes(variant)) throw new Error("Circular bundle composition");
  const children = components.filter((c) => c.bundle_variant_id === variant);
  if (!children.length) return { [variant]: bundles };
  const result: Record<string, number> = {};
  for (const child of children)
    for (const [sku, qty] of Object.entries(
      bomDemand(
        child.component_variant_id,
        bundles * child.quantity,
        components,
        [...trail, variant],
      ),
    ))
      result[sku] = (result[sku] || 0) + qty;
  return result;
}
export function earlyPayment(input: {
  credit: number | null;
  dailySpend: number | null;
  clearingDays: number | null;
  freeCash: number | null;
  buffer: number | null;
  otherOutflows: number;
}) {
  if (
    [
      input.credit,
      input.dailySpend,
      input.clearingDays,
      input.freeCash,
      input.buffer,
    ].some((x) => x === null)
  )
    return {
      status: "UNKNOWN",
      amount: null,
      reason: "Credit, spend, clearing delay and cash buffer must be supplied",
    };
  const { credit, dailySpend, clearingDays, freeCash, buffer } = input as {
    credit: number;
    dailySpend: number;
    clearingDays: number;
    freeCash: number;
    buffer: number;
  };
  const need = Math.max(
    0,
    Math.round(dailySpend * (clearingDays + 1) - credit),
  );
  const usable = Math.max(0, freeCash - buffer - input.otherOutflows);
  return {
    status:
      need === 0
        ? "NO_PAYMENT_NEEDED"
        : usable >= need
          ? "RECOMMEND_PAYMENT"
          : "CASH_CONSTRAINED",
    amount: need,
    reason:
      need === 0
        ? "Credit covers the configured clearing horizon"
        : usable >= need
          ? "Cash covers an early payment after buffer and scheduled liabilities"
          : "Do not recommend a payment that breaches the cash buffer",
  };
}
