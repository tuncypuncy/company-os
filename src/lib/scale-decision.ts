import { scaleScenario, cashForecast, type CashEvent } from "./finance";
import { stockForecast, type Inbound } from "./operations-engine";
export function scaleDecision(input: {
  currentDaily: number;
  proposedDaily: number;
  roas: number;
  cogsBps: number;
  refundBps: number;
  feeBps: number;
  settlementDays: number;
  opening: number | null;
  buffer: number | null;
  availableCredit: number | null;
  clearingDays: number | null;
  paymentMode: "CREDIT" | "DAILY_CASH" | "UNKNOWN";
  asOf: string;
  currency: string;
  entityId?: string;
  outflows: CashEvent[];
  inflows: CashEvent[];
  inventory: {
    sku: string;
    available: number | null;
    daily: number | null;
    inbound: Inbound[];
    fresh: boolean;
  }[];
  coverageComplete: boolean;
  cashFresh: boolean;
  metaFresh: boolean;
  supplierCashBps: number | null;
}) {
  const scenario = scaleScenario({
    ...input,
    availableCredit: input.availableCredit ?? 0,
    availableUnits: null,
    dailyUnits: null,
  });
  const baseline = scaleScenario({
    ...input,
    proposedDaily: input.currentDaily,
    availableCredit: input.availableCredit ?? 0,
    availableUnits: null,
    dailyUnits: null,
  });
  const missing: string[] = [];
  if (input.opening === null || input.buffer === null || !input.cashFresh)
    missing.push("Fresh cash balances and configured safety buffer");
  if (
    input.availableCredit === null ||
    !input.metaFresh ||
    input.clearingDays === null
  )
    missing.push("Fresh Meta credit and confirmed clearing delay");
  if (input.paymentMode === "UNKNOWN")
    missing.push("Advertising cash payment terms");
  if (input.supplierCashBps === null)
    missing.push("Incremental supplier cash timing assumption");
  if (
    !input.coverageComplete ||
    !input.inventory.length ||
    input.inventory.some(
      (i) => !i.fresh || i.available === null || i.daily === null,
    )
  )
    missing.push(
      "Fresh stock, complete SKU/BOM mappings and confirmed fulfillment routing",
    );
  const ratio =
    input.currentDaily > 0 ? input.proposedDaily / input.currentDaily : null;
  const inventory = input.inventory.map((i) => ({
    ...i,
    forecast: stockForecast(
      i.available,
      ratio === null || i.daily === null ? null : i.daily * ratio,
      i.inbound,
      input.asOf,
    ),
  }));
  const horizons = [24, 48, 72, 168].map((hours) => {
    const days = hours / 24;
    const baselineCash =
      input.opening === null || input.buffer === null
        ? null
        : cashForecast({
            opening: input.opening,
            buffer: input.buffer,
            asOf: input.asOf,
            hours,
            currency: input.currency,
            entityId: input.entityId,
            outflows: input.outflows,
            inflows: input.inflows,
          });
    const netDelta =
      scenario.revenue -
      scenario.refunds -
      scenario.fees -
      (baseline.revenue - baseline.refunds - baseline.fees);
    const settlements = Math.round(
      netDelta * Math.max(0, days - input.settlementDays),
    );
    const extraAd =
      input.paymentMode === "DAILY_CASH"
        ? Math.round((input.proposedDaily - input.currentDaily) * days)
        : input.paymentMode === "CREDIT" && input.availableCredit !== null
          ? Math.max(
              0,
              Math.round(input.proposedDaily * days - input.availableCredit),
            ) -
            Math.max(
              0,
              Math.round(input.currentDaily * days - input.availableCredit),
            )
          : null;
    const supplier =
      input.supplierCashBps === null
        ? null
        : Math.round(
            ((scenario.cogs - baseline.cogs) * days * input.supplierCashBps) /
              10000,
          );
    const delta =
      extraAd === null || supplier === null ? null : extraAd + supplier;
    const ending =
      baselineCash === null || delta === null
        ? null
        : baselineCash.ending + settlements - delta;
    return {
      hours,
      additionalOutflow: delta,
      estimatedSettlements: settlements,
      ending,
      fundingNeeded:
        ending === null || input.buffer === null
          ? null
          : Math.max(0, input.buffer - ending),
      baselineFunding: baselineCash?.fundingNeeded ?? null,
    };
  });
  const cashRisk = horizons.some(
    (h) => h.fundingNeeded !== null && h.fundingNeeded > 0,
  )
    ? "HIGH_RISK"
    : horizons.some((h) => h.ending === null)
      ? "UNKNOWN"
      : "HEALTHY";
  const metaRisk =
    input.availableCredit === null ||
    input.clearingDays === null ||
    !input.metaFresh
      ? "UNKNOWN"
      : input.proposedDaily > 0 &&
          input.availableCredit / input.proposedDaily <= input.clearingDays
        ? "HIGH_RISK"
        : "HEALTHY";
  const inventoryRisk = inventory.some(
    (i) => i.forecast.risk === "CRITICAL" || i.forecast.stockoutBeforeInbound,
  )
    ? "HIGH_RISK"
    : !input.coverageComplete ||
        !inventory.length ||
        inventory.some((i) => i.forecast.risk === "UNKNOWN" || !i.fresh)
      ? "UNKNOWN"
      : inventory.some((i) => i.forecast.risk === "WATCH")
        ? "WATCH"
        : "HEALTHY";
  const profitRisk = scenario.profit < 0 ? "HIGH_RISK" : "HEALTHY";
  const overall = [cashRisk, metaRisk, inventoryRisk, profitRisk].includes(
    "HIGH_RISK",
  )
    ? "DO_NOT_SCALE"
    : missing.length
      ? "INCOMPLETE_INPUTS"
      : [cashRisk, metaRisk, inventoryRisk].includes("WATCH")
        ? "SCALE_WITH_CAUTION"
        : "SCENARIO_SUPPORTED";
  return {
    scenario,
    horizons,
    inventory,
    missing,
    risks: {
      cash: cashRisk,
      meta: metaRisk,
      inventory: inventoryRisk,
      profit: profitRisk,
      overall,
    },
    assumptions: [
      "Scenario estimates do not change budgets or move money.",
      "Credit cash represents estimated funding to prevent exhaustion, not an actual invoice.",
      "Incremental supplier cash percentage is an explicit horizon assumption; actual dated obligations remain in baseline.",
    ],
  };
}
