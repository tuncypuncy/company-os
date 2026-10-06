"use client";
import { useState } from "react";
import type { OperationalWorkspace } from "@/lib/operational-workspace";
import { reorderSuggestion } from "@/lib/operations-engine";
import { minor } from "@/lib/finance";
import { amount, Badge } from "./workspace-ui";
export function ReorderPlanner({
  data,
  onPurchase,
}: {
  data: OperationalWorkspace;
  onPurchase: () => void;
}) {
  const [snapshot, setSnapshot] = useState(""),
    [lead, setLead] = useState(""),
    [safety, setSafety] = useState("7"),
    [moq, setMoq] = useState("1"),
    [unit, setUnit] = useState(""),
    [freight, setFreight] = useState("0.00");
  const item = data.inventory.find((i) => i.id === snapshot);
  let result: ReturnType<typeof reorderSuggestion> | null = null,
    error = "";
  if (item && lead !== "" && unit !== "")
    try {
      result = reorderSuggestion({
        available: item.available,
        daily: item.velocity,
        leadDays: Number(lead),
        safetyDays: Number(safety),
        moq: Number(moq),
        unitMinor: minor(unit),
        freightMinor: minor(freight),
        inbound: item.arrivals.map((a) => ({
          quantity: a.quantity,
          eta: a.eta,
          status: "IN_TRANSIT",
        })),
        asOf: data.asOf,
      });
    } catch {
      error = "Enter valid quantities, lead time and monetary amounts.";
    }
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h3>Reorder planning</h3>
          <p>
            Use confirmed lead time and price; recommendations never place
            supplier orders.
          </p>
        </div>
        <Badge>ESTIMATED</Badge>
      </div>
      <div className="finance-form">
        <div className="form-grid">
          <label>
            SKU / warehouse
            <select
              value={snapshot}
              onChange={(e) => setSnapshot(e.target.value)}
            >
              <option value="">Select stock source…</option>
              {data.inventory.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.sku} · {i.warehouse}
                </option>
              ))}
            </select>
          </label>
          {[
            ["Supplier lead days", lead, setLead],
            ["Safety coverage days", safety, setSafety],
            ["Minimum order quantity", moq, setMoq],
            ["Price / physical unit", unit, setUnit],
            ["Freight / other payment", freight, setFreight],
          ].map(([label, value, set]) => (
            <label key={String(label)}>
              {String(label)}
              <input
                inputMode="decimal"
                value={String(value)}
                onChange={(e) => (set as (s: string) => void)(e.target.value)}
              />
            </label>
          ))}
        </div>
        {error && <p className="form-error">{error}</p>}
        {result ? (
          <>
            <div className="data-pair">
              <span>Suggested physical units</span>
              <strong>
                {result.quantity === null
                  ? "Unknown"
                  : result.quantity.toLocaleString()}
              </strong>
            </div>
            <div className="data-pair">
              <span>Estimated supplier/freight payment</span>
              <strong>{amount(result.cashRequired, data.currency)}</strong>
            </div>
            <div className="data-pair">
              <span>Recommended order by</span>
              <strong>
                {result.orderBy
                  ? new Date(result.orderBy).toLocaleDateString()
                  : "No finite date"}
              </strong>
            </div>
            <p>{result.reason}</p>
            {item?.freshness === "STALE" && (
              <Badge tone="warning">
                Stock source is stale — refresh before ordering
              </Badge>
            )}
            <button className="secondary" onClick={onPurchase}>
              Review a supplier purchase
            </button>
          </>
        ) : (
          <p>
            Choose a stock source and enter actual supplier terms to calculate a
            recommendation.
          </p>
        )}
      </div>
    </section>
  );
}
