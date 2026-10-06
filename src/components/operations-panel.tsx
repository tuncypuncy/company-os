"use client";
import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  RefreshCw,
  ArrowUpRight,
  AlertTriangle,
  Check,
  Search,
} from "lucide-react";
import { operations, type Field } from "@/lib/operation-definitions";
import type { OperationalWorkspace } from "@/lib/operational-workspace";
import type { Workspace } from "@/lib/workspace";
import type { User } from "@/lib/auth";
import { api, amount, Badge, Empty } from "./workspace-ui";
import { Lineage } from "./lineage";
import { ReorderPlanner } from "./reorder-planner";
import { Modal } from "./finance-forms";
type Row = Record<string, unknown>;
const columns: Record<string, string[]> = {
  expenses: [
    "vendor",
    "category",
    "amount_minor",
    "recognized_date",
    "recognition",
    "source",
  ],
  recurring: [
    "vendor",
    "category",
    "amount_minor",
    "frequency",
    "next_due",
    "active",
    "last_verified_at",
  ],
  inflows: ["title", "amount_minor", "expected_at", "status", "source"],
  pools: [
    "name",
    "purchased_quantity",
    "remaining_quantity",
    "total_minor",
    "remaining_value_minor",
    "component",
    "source",
  ],
  orders: [
    "external_id",
    "ordered_at",
    "gross_minor",
    "discount_minor",
    "processing_minor",
    "source",
  ],
  costs: [
    "external_id",
    "rule_version",
    "estimated_minor",
    "actual_minor",
    "variance_minor",
    "calculated_at",
  ],
  refunds: [
    "external_id",
    "platform_minor",
    "internal_minor",
    "recovered_cogs_minor",
    "fee_impact_minor",
    "reason",
  ],
  payroll: [
    "employee",
    "period",
    "gross_minor",
    "deductions_minor",
    "employer_minor",
  ],
  products: ["name", "status"],
  variants: ["sku", "bundle_size", "external_id"],
  supplierSkus: ["sku", "product_id"],
  warehouses: ["name", "country"],
  shipments: ["id", "status", "eta", "carrier", "tracking", "source"],
  metaPayments: [
    "stage",
    "amount_minor",
    "expected_clearing_at",
    "actual_clearing_at",
  ],
  fx: ["base_currency", "quote_currency", "rate", "source", "observed_at"],
};
const labels: Record<string, string> = {
  expenses: "Expense ledger",
  recurring: "Applications & recurring contracts",
  inflows: "Expected settlements",
  pools: "Prepaid economics",
  orders: "Orders & source records",
  costs: "Preserved estimates & reconciliations",
  refunds: "Reviewed refund events",
  payroll: "Payroll runs",
  products: "Canonical catalog",
  variants: "Commercial SKUs",
  supplierSkus: "Supplier SKUs",
  warehouses: "Warehouse directory",
  shipments: "Inbound supply chain",
  metaPayments: "Credit clearing lifecycle",
  fx: "Observed currency rates",
};
export function OperationsPanel({
  section,
  data,
  user,
  onRefresh,
}: {
  section: string;
  data: Workspace;
  user: User;
  onRefresh: () => Promise<void>;
}) {
  const [d, setData] = useState<OperationalWorkspace | null>(null),
    [error, setError] = useState(""),
    [action, setAction] = useState(""),
    [success, setSuccess] = useState(""),
    [search, setSearch] = useState(""),
    [us, setUs] = useState(false),
    [tab, setTab] = useState("");
  const load = useCallback(async () => {
    try {
      setData(
        await api(
          `/api/operations?store=${data.storeId}&currency=${data.currency}&entity=${data.entityId || ""}`,
        ),
      );
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load records");
    }
  }, [data.storeId, data.currency, data.entityId]);
  useEffect(() => {
    let cancelled = false;
    api(
      `/api/operations?store=${data.storeId}&currency=${data.currency}&entity=${data.entityId || ""}`,
    )
      .then((v) => {
        if (!cancelled) setData(v);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [data.storeId, data.currency, data.entityId]);
  const sections =
    section === "inventory"
      ? ["inventory", "catalog"]
      : section === "expenses"
        ? ["expenses", "payroll"]
        : section === "commerce"
          ? ["commerce"]
          : section === "cash"
            ? ["cash", "settings"]
            : section === "meta"
              ? ["meta"]
              : ["prepaid"];
  const tables =
    section === "inventory"
      ? ["shipments", "variants", "supplierSkus", "warehouses", "products"]
      : section === "expenses"
        ? [
            "expenses",
            "recurring",
            ...(user.role === "OWNER" ? ["payroll"] : []),
          ]
        : section === "commerce"
          ? ["orders", "costs", ...(user.role === "OWNER" ? ["refunds"] : [])]
          : section === "cash"
            ? ["inflows", "fx"]
            : section === "meta"
              ? ["metaPayments"]
              : ["pools"];
  const selected = tables.includes(tab) ? tab : tables[0];
  return (
    <div className="operations-area">
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button onClick={load}>Retry</button>
        </div>
      )}
      {success && (
        <div className="success-banner" role="status">
          <Check size={16} />
          {success}
        </div>
      )}
      <div className="operations-toolbar">
        <div>
          <span className="eyebrow">OPERATING WORKSPACE</span>
          <h2>
            {section === "inventory"
              ? "Stock, mappings & arrivals"
              : section === "meta"
                ? "Credit, spend & payment clearing"
                : section === "expenses"
                  ? "Every cost. Every renewal."
                  : section === "prepaid"
                    ? "Paid upfront. Allocated precisely."
                    : section === "commerce"
                      ? "Orders, refunds & actual costs"
                      : "Settlements & forecast policy"}
          </h2>
        </div>
        <button className="secondary" onClick={load}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>
      <div className="action-grid">
        {Object.entries(operations)
          .filter(
            ([, spec]) =>
              sections.includes(spec.section) &&
              (!spec.owner || user.role === "OWNER"),
          )
          .map(([key, spec]) => (
            <button
              key={key}
              className="secondary"
              onClick={() => setAction(key)}
            >
              <Plus size={14} />
              {spec.label}
            </button>
          ))}
      </div>
      {!d ? (
        <div className="loading">Loading source records…</div>
      ) : (
        <>
          {section === "inventory" && (
            <>
              <div className="panel-heading">
                <div>
                  <h3>Inventory coverage</h3>
                  <p>{d.inventoryAssumption}</p>
                </div>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={us}
                    onChange={(e) => setUs(e.target.checked)}
                  />{" "}
                  US warehouses
                </label>
              </div>
              <div className="inventory-grid">
                {d.inventory
                  .filter((s) => !us || s.country === "US")
                  .map((s) => (
                    <section className="panel stock-card" key={String(s.id)}>
                      <div className="card-label">
                        {s.sku}
                        <Badge
                          tone={
                            s.risk === "CRITICAL"
                              ? "danger"
                              : s.risk === "WATCH"
                                ? "warning"
                                : "neutral"
                          }
                        >
                          {s.risk}
                        </Badge>
                      </div>
                      <h3>
                        {String(s.warehouse)} ·{" "}
                        {String(s.country || "Country unknown")}
                      </h3>
                      <div className="stock-number">
                        {s.available === null
                          ? "Unknown"
                          : Number(s.available).toLocaleString()}
                        <small>available units</small>
                      </div>
                      <div className="stock-stats">
                        <span>
                          {s.days === null ? "—" : s.days.toFixed(1)} days of
                          stock
                        </span>
                        <span>
                          {s.velocity === null
                            ? "Unknown demand"
                            : s.velocity.toFixed(1) + " units/day · 7D"}
                        </span>
                      </div>
                      <p>
                        Stockout{" "}
                        {s.stockoutAt
                          ? new Date(s.stockoutAt).toLocaleString()
                          : "not forecast"}
                      </p>
                      <div className="velocity-strip">
                        {Object.entries(s.velocities).map(([w, n]) => (
                          <span key={w}>
                            {w}D{" "}
                            <b>{n === null ? "—" : Number(n).toFixed(1)}</b>
                          </span>
                        ))}
                      </div>
                      {s.arrivals.map((a, i) => (
                        <p
                          key={i}
                          className={a.balanceBefore < 0 ? "negative" : ""}
                        >
                          +{a.quantity.toLocaleString()} inbound ·{" "}
                          {new Date(a.eta).toLocaleDateString()} ·{" "}
                          {Math.floor(a.balanceBefore)} units before arrival
                        </p>
                      ))}
                      <Badge>
                        {String(s.source)} · {s.freshness}
                      </Badge>
                    </section>
                  ))}
              </div>
              {!d.inventory.length && (
                <Empty title="Record your first stock snapshot">
                  Add a supplier, supplier SKU and warehouse, map a commercial
                  SKU, then record available units. Forecasts use your actual
                  source records.
                </Empty>
              )}
            </>
          )}
          {section === "inventory" && (
            <ReorderPlanner data={d} onPurchase={() => setAction("purchase")} />
          )}
          {section === "meta" && (
            <div className="inventory-grid">
              {d.facilities.map((f) => (
                <section className="panel stock-card" key={String(f.id)}>
                  <div className="card-label">
                    {String(f.name)}
                    <Badge>{f.freshness}</Badge>
                  </div>
                  <div className="stock-number">
                    {amount(f.available, data.currency)}
                    <small>available credit</small>
                  </div>
                  <p>
                    {f.days === null
                      ? "No finite exhaustion forecast"
                      : f.days.toFixed(1) + " days at entered budget"}
                  </p>
                  <p>
                    Limit {amount(f.limit, data.currency)} · outstanding{" "}
                    {amount(f.debt, data.currency)}
                  </p>
                  <p>{f.recommendation.reason}</p>
                  <Badge
                    tone={
                      f.recommendation.status === "CASH_CONSTRAINED"
                        ? "danger"
                        : "neutral"
                    }
                  >
                    {f.recommendation.status.replaceAll("_", " ")}
                  </Badge>
                  {f.recommendation.amount !== null && (
                    <p>
                      Suggested early funding{" "}
                      {amount(f.recommendation.amount, data.currency)}
                    </p>
                  )}
                  <p className="subtle">
                    {String(f.source)} · snapshot{" "}
                    {f.observedAt
                      ? new Date(String(f.observedAt)).toLocaleString()
                      : "unavailable"}
                  </p>
                </section>
              ))}
            </div>
          )}
          {section === "prepaid" && (
            <div className="info-banner">
              Remaining allocated value{" "}
              {amount(d.summary.prepaidRemaining, data.currency)}. Payments
              enter cash once; consumed components replace the matched
              order-cost component.
            </div>
          )}
          <section className="panel">
            <div className="record-tabs">
              {tables.map((key) => (
                <button
                  key={key}
                  className={selected === key ? "selected" : ""}
                  onClick={() => setTab(key)}
                >
                  {labels[key]}
                </button>
              ))}
            </div>
            <div className="panel-heading">
              <h3>{labels[selected]}</h3>
              <label className="record-search">
                <Search size={15} />
                <input
                  aria-label="Search records"
                  placeholder="Search records…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
            </div>
            <RecordTable
              rows={(d.tables[selected] || []).filter((r) =>
                JSON.stringify(r).toLowerCase().includes(search.toLowerCase()),
              )}
              kind={selected === "fx" ? undefined : selected}
              fields={columns[selected]}
              currency={data.currency}
            />
          </section>
          {section === "inventory" && d.tables.shipmentEvents.length > 0 && (
            <section className="panel">
              <div className="panel-heading">
                <h3>Supply chain event history</h3>
                <p>Only recorded stages are shown.</p>
              </div>
              <div className="shipment-timeline">
                {d.tables.shipmentEvents.map((e) => (
                  <div key={String(e.id)}>
                    <span className="timeline-dot" />
                    <b>{String(e.status).replaceAll("_", " ")}</b>
                    <small>
                      {new Date(String(e.occurred_at)).toLocaleString()}
                    </small>
                    <small>Shipment {String(e.shipment_id).slice(0, 12)}</small>
                  </div>
                ))}
              </div>
            </section>
          )}
          {d.alerts.length > 0 && (
            <section className="panel">
              <div className="panel-heading">
                <h3>Attention queue</h3>
                <Badge>{d.alerts.length} signals</Badge>
              </div>
              <div className="attention-list">
                {d.alerts.slice(0, 12).map((a) => (
                  <div key={a.id}>
                    <AlertTriangle size={17} />
                    <div>
                      <b>{a.reason}</b>
                      <p>{a.recommendation}</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={async () => {
                        try {
                          await api("/api/alerts", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              store: data.storeId,
                              currency: data.currency,
                              ...(data.entityId
                                ? { entity: data.entityId }
                                : {}),
                              key: a.id,
                              reason: "Reviewed in the operating workspace",
                            }),
                          });
                          await load();
                        } catch (e) {
                          setError(
                            e instanceof Error ? e.message : "Review failed",
                          );
                        }
                      }}
                    >
                      Acknowledge
                    </button>
                    <Badge
                      tone={a.severity === "CRITICAL" ? "danger" : "warning"}
                    >
                      {a.severity}
                    </Badge>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
      {action && d && (
        <Modal title={operations[action].label} onClose={() => setAction("")}>
          <OperationForm
            action={action}
            data={data}
            operational={d}
            onSaved={async (result) => {
              setSuccess(result);
              setAction("");
              await load();
              await onRefresh();
            }}
          />
        </Modal>
      )}
    </div>
  );
}
export function RecordTable({
  rows,
  fields,
  currency,
  kind,
}: {
  kind?: string;
  rows: Row[];
  fields: string[];
  currency: string;
}) {
  const [lineage, setLineage] = useState("");
  if (!rows.length)
    return (
      <Empty title="No records in this context">
        Add reviewed source records using the actions above. Empty does not mean
        zero activity.
      </Empty>
    );
  return (
    <div className="table-scroll">
      {lineage && kind && (
        <Lineage kind={kind} id={lineage} onClose={() => setLineage("")} />
      )}
      <table>
        <thead>
          <tr>
            {kind && <th>Evidence</th>}
            {fields.map((f) => (
              <th key={f}>{f.replaceAll("_minor", "").replaceAll("_", " ")}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 200).map((r, i) => (
            <tr key={String(r.id ?? i)}>
              {kind && (
                <td>
                  <button
                    className="text-button"
                    onClick={() => setLineage(String(r.id))}
                  >
                    View source
                  </button>
                </td>
              )}
              {fields.map((f) => (
                <td key={f}>
                  {r[f] === null || r[f] === undefined
                    ? "—"
                    : f.endsWith("_minor")
                      ? amount(r[f], currency)
                      : typeof r[f] === "boolean"
                        ? r[f]
                          ? "Active"
                          : "Cancelled"
                        : f === "id"
                          ? String(r[f]).slice(0, 12)
                          : String(r[f]).replace(/T00:00:00\.000Z$/, "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 200 && (
        <p className="subtle">
          Showing the first 200 records. Use search to narrow the result.
        </p>
      )}
    </div>
  );
}
function OperationForm({
  action,
  data,
  operational,
  onSaved,
}: {
  action: string;
  data: Workspace;
  operational: OperationalWorkspace;
  onSaved: (message: string) => Promise<void>;
}) {
  const spec = operations[action],
    today = new Date().toISOString().slice(0, 10);
  const [entity, setEntity] = useState(data.entityId || ""),
    [values, setValues] = useState<Record<string, string>>(() =>
      Object.fromEntries(
        spec.fields.map((f) => [
          f.name,
          f.value ??
            (f.type === "date"
              ? today
              : f.type === "datetime-local"
                ? new Date().toISOString().slice(0, 16)
                : (f.options?.[0] ?? "")),
        ]),
      ),
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="finance-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          const result = await api("/api/operations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action,
              storeId: data.storeId,
              entityId: entity,
              currency: data.currency,
              values,
            }),
          });
          await onSaved(
            result.calculated !== undefined
              ? `${result.calculated} new snapshots saved; ${result.missing} unmatched lines.`
              : result.generated !== undefined
                ? `${result.generated} recurring occurrences processed.`
                : "Record saved. Sources and audit history retained.",
          );
        } catch (e) {
          setError(e instanceof Error ? e.message : "Save failed");
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="form-intro">{spec.description}</p>
      <div className="info-banner">
        {data.stores.find((s) => s.id === data.storeId)?.name} · {data.currency}{" "}
        · {data.mode === "demo" ? "DEMO DATA" : "MANUAL SOURCE"}
      </div>
      <label>
        Responsible legal entity
        <select
          required
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
        >
          <option value="">Select confirmed attribution…</option>
          {data.entities.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </label>
      <div className="form-grid">
        {spec.fields.map((f) => (
          <label key={f.name}>
            {f.label}
            {f.lookup ? (
              <select
                required={!f.optional}
                value={values[f.name] || ""}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [f.name]: e.target.value }))
                }
              >
                <option value="">Select…</option>
                {(operational.lookups[f.lookup] || []).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            ) : f.options ? (
              <select
                value={values[f.name]}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [f.name]: e.target.value }))
                }
              >
                {f.options.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            ) : (
              <input
                required={!f.optional}
                type={f.type === "textarea" ? "text" : f.type || "text"}
                min={f.type === "number" ? 0 : undefined}
                max={f.type === "number" ? 1000000000 : undefined}
                maxLength={1000}
                value={values[f.name] || ""}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [f.name]: e.target.value }))
                }
              />
            )}
          </label>
        ))}
      </div>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      <div className="modal-actions">
        <button className="primary" disabled={busy}>
          {busy ? "Saving…" : "Confirm & save"}
          <ArrowUpRight size={15} />
        </button>
      </div>
    </form>
  );
}
