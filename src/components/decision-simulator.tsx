"use client";
import { useState, useEffect } from "react";
import { SlidersHorizontal, Save } from "lucide-react";
import type { Workspace } from "@/lib/workspace";
import type { OperationalWorkspace } from "@/lib/operational-workspace";
import type { scaleDecision } from "@/lib/scale-decision";
import type { User } from "@/lib/auth";
import { api, amount, Badge } from "./workspace-ui";
type Result = ReturnType<typeof scaleDecision> & { id: string | null };
export function DecisionSimulator({
  data: d,
  user,
}: {
  data: Workspace;
  user: User;
}) {
  const [op, setOp] = useState<OperationalWorkspace | null>(null),
    [result, setResult] = useState<Result | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [values, setValues] = useState({
      current: String((d.meta?.dailySpend || 0) / 100),
      proposed: String((d.meta?.dailySpend || 0) / 100),
      roas: "3.2",
      cogs: "25",
      refunds: "2",
      fees: "3.5",
      delay: "3",
      supplierCash: "",
      paymentMode: "UNKNOWN",
      warehouseId: "",
      billingId: "",
    }),
    [routing, setRouting] = useState(false);
  const [saved, setSaved] = useState<
    { id: string; created_at: string; results: Result }[]
  >([]);
  useEffect(() => {
    api(
      `/api/operations?store=${d.storeId}&currency=${d.currency}&entity=${d.entityId || ""}`,
    )
      .then(setOp)
      .catch((e) => setError(e.message));
    if (user.role === "OWNER")
      api(`/api/scenarios?store=${d.storeId}&currency=${d.currency}`)
        .then((r) => setSaved(r.scenarios))
        .catch((e) => setError(e.message));
  }, [d.storeId, d.currency, d.entityId, user.role]);
  async function calculate(save = false) {
    setBusy(true);
    setError("");
    try {
      const r = await api("/api/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          storeId: d.storeId,
          currency: d.currency,
          ...(d.entityId ? { entityId: d.entityId } : {}),
          supplierCash: values.supplierCash === "" ? null : values.supplierCash,
          routingConfirmed: routing,
          save,
        }),
      });
      setResult(r);
      if (save) {
        const list = await api(
          `/api/scenarios?store=${d.storeId}&currency=${d.currency}`,
        );
        setSaved(list.scenarios);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scenario failed");
    } finally {
      setBusy(false);
    }
  }
  const update = (key: string, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setResult(null);
  };
  return (
    <>
      <div className="decision-brief">
        <SlidersHorizontal size={22} />
        <div>
          <strong>One decision. Four operating constraints.</strong>
          <p>
            Disclosed scenario inputs combine cash, credit, contribution profit
            and physical inventory. No budgets or payments change.
          </p>
        </div>
        <Badge tone="demo">ESTIMATED</Badge>
      </div>
      <div className="scale-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>Scenario assumptions</h2>
            <Badge>{d.currency}</Badge>
          </div>
          {[
            ["current", "Current Meta spend / day"],
            ["proposed", "Proposed Meta spend / day"],
            ["roas", "Expected revenue / spend (ROAS)"],
            ["cogs", "True COGS / gross revenue (%)"],
            ["refunds", "Refunds / gross revenue (%)"],
            ["fees", "Processing fees / gross revenue (%)"],
            ["delay", "Settlement delay (days)"],
            ["supplierCash", "Incremental supplier cash within horizon (%)"],
          ].map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                type="number"
                min="0"
                step="0.01"
                value={values[key as keyof typeof values]}
                onChange={(e) => update(key, e.target.value)}
                placeholder={
                  key === "supplierCash" ? "Unknown until entered" : undefined
                }
              />
            </label>
          ))}
          <label>
            Advertising payment terms
            <select
              value={values.paymentMode}
              onChange={(e) => update("paymentMode", e.target.value)}
            >
              <option value="UNKNOWN">Unknown</option>
              <option value="CREDIT">Credit facility funding</option>
              <option value="DAILY_CASH">Daily cash funding</option>
            </select>
          </label>
          <label>
            Meta facility
            <select
              value={values.billingId}
              onChange={(e) => update("billingId", e.target.value)}
            >
              <option value="">Select confirmed facility…</option>
              {op?.lookups.billing.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fulfillment warehouse
            <select
              value={values.warehouseId}
              onChange={(e) => update("warehouseId", e.target.value)}
            >
              <option value="">Select confirmed routing…</option>
              {op?.lookups.warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={routing}
              onChange={(e) => {
                setRouting(e.target.checked);
                setResult(null);
              }}
            />
            I confirm this scenario’s mapped demand is fulfilled from the
            selected warehouse.
          </label>
          <p className="source-note">
            Initial ROAS/rate values are illustrative editable assumptions.
            Leave unknown timing empty; incomplete inputs prevent a supported
            scale decision.
          </p>
          {user.role === "OWNER" ? (
            <div className="action-grid">
              <button
                className="primary"
                disabled={busy}
                onClick={() => calculate(false)}
              >
                Calculate scenario
              </button>
              <button
                className="secondary"
                disabled={busy || !result}
                onClick={() => calculate(true)}
              >
                <Save size={14} />
                Save scenario
              </button>
            </div>
          ) : (
            <p className="source-note">
              Owner permission is required for combined financial scenarios.
            </p>
          )}
        </section>
        <section>
          {error && (
            <div className="error-banner" role="alert">
              {error}
            </div>
          )}
          {result ? (
            <>
              <div className="decision-brief">
                <div>
                  <strong>{result.risks.overall.replaceAll("_", " ")}</strong>
                  <p>
                    {result.missing.length
                      ? result.missing.join(" · ")
                      : "Scenario inputs support the modeled proposal. This is a managerial estimate."}
                  </p>
                </div>
                <Badge
                  tone={
                    result.risks.overall === "DO_NOT_SCALE"
                      ? "danger"
                      : "warning"
                  }
                >
                  DECISION
                </Badge>
              </div>
              <div className="metrics scale-metrics">
                <div className="metric">
                  <span className="card-label">Expected daily revenue</span>
                  <strong>{amount(result.scenario.revenue, d.currency)}</strong>
                </div>
                <div className="metric featured">
                  <span className="card-label">
                    Expected daily contribution
                  </span>
                  <strong>{amount(result.scenario.profit, d.currency)}</strong>
                </div>
              </div>
              <section className="panel spaced">
                <div className="panel-heading">
                  <h2>Incremental cash & funding</h2>
                  <Badge>ESTIMATED</Badge>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Horizon</th>
                        <th>Additional outflow</th>
                        <th>Extra net settlements</th>
                        <th>Ending cash</th>
                        <th>Funding needed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.horizons.map((h) => (
                        <tr key={h.hours}>
                          <td>
                            {h.hours === 168 ? "7 days" : h.hours + " hours"}
                          </td>
                          <td>{amount(h.additionalOutflow, d.currency)}</td>
                          <td>{amount(h.estimatedSettlements, d.currency)}</td>
                          <td>{amount(h.ending, d.currency)}</td>
                          <td>{amount(h.fundingNeeded, d.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className="panel spaced">
                <div className="panel-heading">
                  <h2>Operating constraints</h2>
                </div>
                {Object.entries(result.risks)
                  .filter(([k]) => k !== "overall")
                  .map(([k, v]) => (
                    <div className="data-pair" key={k}>
                      <span>{k.toUpperCase()}</span>
                      <Badge
                        tone={
                          v === "HIGH_RISK"
                            ? "danger"
                            : v === "WATCH"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {v.replaceAll("_", " ")}
                      </Badge>
                    </div>
                  ))}
                {result.inventory.map((i) => (
                  <div className="data-pair" key={i.sku}>
                    <span>{i.sku} · forecast coverage</span>
                    <strong>
                      {i.forecast.days === null
                        ? "Unknown"
                        : i.forecast.days.toFixed(1) + " days"}
                      {i.forecast.stockoutBeforeInbound
                        ? " · STOCKOUT BEFORE INBOUND"
                        : ""}
                    </strong>
                  </div>
                ))}
                <p className="source-note">{result.assumptions.join(" ")}</p>
              </section>
            </>
          ) : (
            <section className="panel">
              <div className="panel-heading">
                <h2>Build a decision you can explain.</h2>
              </div>
              <p className="source-note">
                Select source-backed cash, facility and warehouse inputs.
                Missing information remains visible rather than becoming a
                safe-to-scale verdict.
              </p>
            </section>
          )}
          {saved.length > 0 && (
            <section className="panel spaced">
              <div className="panel-heading">
                <h2>Saved scenario history</h2>
              </div>
              {saved.map((s) => (
                <button
                  key={s.id}
                  className="data-pair"
                  onClick={() => setResult({ ...s.results, id: s.id })}
                >
                  <span>{new Date(s.created_at).toLocaleString()}</span>
                  <Badge>{s.results.risks.overall.replaceAll("_", " ")}</Badge>
                </button>
              ))}
            </section>
          )}
        </section>
      </div>
    </>
  );
}
