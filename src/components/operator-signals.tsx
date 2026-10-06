"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, Boxes, ArrowUpRight } from "lucide-react";
import type { Workspace } from "@/lib/workspace";
import type { OperationalWorkspace } from "@/lib/operational-workspace";
import { api, amount, Badge, type View } from "./workspace-ui";
export function OperatorSignals({
  data,
  onNavigate,
}: {
  data: Workspace;
  onNavigate: (v: View) => void;
}) {
  const [op, setOp] = useState<OperationalWorkspace | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    if (data.storeId === "all") {
      setOp(null);
      return;
    }
    let cancelled = false;
    api(
      `/api/operations?store=${data.storeId}&currency=${data.currency}&entity=${data.entityId || ""}`,
    )
      .then((r) => {
        if (!cancelled) setOp(r);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [data.storeId, data.currency, data.entityId, data.asOf]);
  return (
    <>
      <div className="metrics spaced">
        <article className="metric">
          <span className="metric-label">Operating expenses</span>
          <div className="metric-value">
            {amount(data.metrics.operatingExpenses, data.currency)}
          </div>
          <p className="metric-note">
            Recognized in selected period · excludes capital, COGS-linked and
            personal items
          </p>
        </article>
        <article className="metric">
          <span className="metric-label">Managerial operating profit</span>
          <div className="metric-value">
            {amount(data.metrics.operatingProfit, data.currency)}
          </div>
          <p className="metric-note">
            Contribution less recognized operating costs · not statutory
            accounting profit
          </p>
        </article>
        <article className="metric">
          <span className="metric-label">Physical stock coverage</span>
          <div className="metric-value">
            {op ? op.inventory.filter((i) => i.country === "US").length : "—"}
          </div>
          <p className="metric-note">
            US SKU/warehouse sources ·{" "}
            {op
              ? op.inventory.filter(
                  (i) => i.risk === "CRITICAL" || i.stockoutBeforeInbound,
                ).length + " critical risks"
              : "Select a store for routing-aware stock"}
          </p>
          <button
            className="text-button"
            onClick={() => onNavigate("inventory")}
          >
            Review stock <ArrowUpRight size={13} />
          </button>
        </article>
        <article className="metric">
          <span className="metric-label">Data coverage</span>
          <div className="metric-value">
            {data.metrics.missingCosts +
              data.metrics.missingFees +
              data.metrics.missingRefundBasis}
          </div>
          <p className="metric-note">
            Unmatched costs, unknown fees or unreviewed refund basis. Unknown
            inputs prevent confirmed profitability.
          </p>
        </article>
      </div>
      {error && <div className="error-banner">{error}</div>}
      {op && op.alerts.length > 0 && (
        <section className="panel spaced">
          <div className="panel-heading">
            <div>
              <h2>Decisions waiting for you.</h2>
              <p>
                Current cash, credit, inventory and source-freshness signals.
              </p>
            </div>
            <Badge tone="warning">{op.alerts.length} active</Badge>
          </div>
          <div className="attention-list">
            {op.alerts.slice(0, 5).map((a) => (
              <div key={a.id}>
                <AlertTriangle size={18} />
                <div>
                  <b>{a.reason}</b>
                  <p>{a.recommendation}</p>
                </div>
                <button
                  className="text-button"
                  onClick={() =>
                    onNavigate(
                      a.kind.includes("META")
                        ? "meta"
                        : a.kind.includes("CASH") || a.kind === "OVERDUE"
                          ? "cash"
                          : "inventory",
                    )
                  }
                >
                  Review <ArrowUpRight size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
