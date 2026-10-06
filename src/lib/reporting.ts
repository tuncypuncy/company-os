import { getDb } from "./db";
import { workspace, type Workspace } from "./workspace";
import { integer } from "./finance";
export function convertMinor(amount: number, rate: string) {
  if (!/^\d+(\.\d{1,10})?$/.test(rate)) throw new Error("Invalid FX rate");
  const [whole, fraction = ""] = rate.split(".");
  const scale = 10n ** BigInt(fraction.length),
    numerator = BigInt(whole + fraction);
  const product = BigInt(amount) * numerator;
  const rounded =
    (product >= 0n ? product + scale / 2n : product - scale / 2n) / scale;
  const result = Number(rounded);
  if (!Number.isSafeInteger(result)) throw new Error("FX conversion overflow");
  return result;
}
export async function reportingWorkspace(
  store: string,
  currency: string,
  days: number,
  entity?: string,
  owner = true,
  brand?: string,
  range?: { from: string; to: string },
): Promise<Workspace> {
  if (store !== "all")
    return workspace(store, currency, days, entity, owner, range);
  const db = await getDb(),
    stores = (
      await db.query<{ id: string }>(
        "SELECT id FROM stores WHERE ($1::text IS NULL OR brand_id=$1)",
        [brand ?? null],
      )
    ).rows;
  if (!stores.length) throw new Error("No stores match this brand");
  const reports = await Promise.all(
      stores.map((s) => workspace(s.id, currency, days, entity, owner, range)),
    ),
    first = reports[0];
  const sum = (values: (number | null)[]) =>
    values.some((v) => v === null)
      ? null
      : integer(values.reduce<number>((n, v) => n + (v ?? 0), 0));
  const economic = reports.filter((r) => r.metrics.orders > 0),
    economicSum = (
      key:
        | "net"
        | "profit"
        | "cogs"
        | "ads"
        | "refunds"
        | "fees"
        | "operatingExpenses"
        | "operatingProfit",
    ) => (economic.length ? sum(economic.map((r) => r.metrics[key])) : null);
  const net = economicSum("net"),
    profit = economicSum("profit");
  const balances = reports.flatMap((r) => r.cash.balances),
    opening = balances.length
      ? integer(balances.reduce((n, r) => n + integer(r.available_minor), 0))
      : null;
  // Per-entity/store liabilities are unique. Missing opening coverage must not be turned into a supported group balance.
  const cashReports = reports.filter((r) => r.cash.opening !== null);
  const missingCash = reports.some(
    (r) =>
      r.cash.opening === null &&
      (r.obligations.some(
        (o) => o.scope === "COMPANY" && o.status === "SCHEDULED",
      ) ||
        r.metrics.orders > 0),
  );
  const forecasts = first.cash.forecasts.map((f, i) => ({
    hours: f.hours,
    ...Object.fromEntries(
      [
        "outgoing",
        "incoming",
        "ending",
        "buffer",
        "surplus",
        "fundingNeeded",
      ].map((k) => [
        k,
        missingCash || !cashReports.length
          ? null
          : sum(
              cashReports.map(
                (r) =>
                  r.cash.forecasts[i][k as keyof typeof f] as number | null,
              ),
            ),
      ]),
    ),
  })) as Workspace["cash"]["forecasts"];
  const chartBase = reports.find((r) => r.chart.length)?.chart ?? [];
  const chart = chartBase.length
    ? chartBase.map((row) => {
        const daily = reports
          .map((r) => r.chart.find((d) => d.date === row.date))
          .filter(Boolean) as typeof first.chart;
        return {
          date: row.date,
          revenue: daily.reduce((n, r) => n + r.revenue, 0),
          cogs: daily.some((r) => r.cogs === null)
            ? null
            : daily.reduce((n, r) => n + Math.round((r.cogs ?? 0) * 100), 0) /
              100,
          ads: daily.reduce((n, r) => n + r.ads, 0),
        };
      })
    : (reports.find((r) => r.chart.length)?.chart ?? []);
  return {
    ...first,
    storeId: "all",
    chart,
    metrics: {
      ...first.metrics,
      net,
      profit,
      margin: net && profit !== null ? profit / net : null,
      cogs: economicSum("cogs"),
      ads: economicSum("ads"),
      refunds: economicSum("refunds") ?? 0,
      fees: economicSum("fees"),
      operatingExpenses: reports.reduce(
        (n, r) => n + r.metrics.operatingExpenses,
        0,
      ),
      operatingProfit:
        profit === null
          ? null
          : profit -
            reports.reduce((n, r) => n + r.metrics.operatingExpenses, 0),
      orders: reports.reduce((n, r) => n + r.metrics.orders, 0),
      missingCosts: reports.reduce((n, r) => n + r.metrics.missingCosts, 0),
      missingRefunds: reports.reduce((n, r) => n + r.metrics.missingRefunds, 0),
      missingFees: reports.reduce((n, r) => n + r.metrics.missingFees, 0),
      missingRefundBasis: reports.reduce(
        (n, r) => n + r.metrics.missingRefundBasis,
        0,
      ),
    },
    costs: reports.flatMap((r) => r.costs),
    costRules: reports.flatMap((r) => r.costRules),
    cash: {
      opening: missingCash ? null : opening,
      balances,
      forecasts,
      bufferConfigured:
        cashReports.length > 0 &&
        cashReports.every((r) => r.cash.bufferConfigured),
    },
    obligations: reports.flatMap((r) => r.obligations),
    invoices: reports.flatMap((r) => r.invoices),
    recurring: reports.flatMap((r) => r.recurring),
    meta: null,
    assumptions: [
      "Group totals include only the selected original currency; no silent FX conversion.",
      "Cash is not assumed transferable between legal entities. Funding needs are summed per store, not netted across companies.",
      "Group credit facilities are reviewed separately in their store contexts.",
      ...first.assumptions,
    ],
  };
}
