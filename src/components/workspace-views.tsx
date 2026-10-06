"use client";
import { useState, useMemo } from "react";
import {
  Activity,
  ArrowDownLeft,
  Check,
  ArrowUpRight,
  Boxes,
  Clock,
  Wallet,
  ShieldCheck,
  ChevronRight,
  Plus,
  SlidersHorizontal,
  AlertTriangle,
  Plug,
  CalendarDays,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { User } from "@/lib/auth";
import type { Workspace } from "@/lib/workspace";
import { orderCost } from "@/lib/finance";
import { amount, day, api, Badge, Empty, type View } from "./workspace-ui";
import { Modal } from "./finance-forms";
function Metric({
  label,
  value,
  children,
  featured = false,
}: {
  label: string;
  value: string;
  children: React.ReactNode;
  featured?: boolean;
}) {
  return (
    <article className={`metric ${featured ? "featured" : ""}`}>
      <div className="metric-label">
        {label}
        {featured && <ArrowUpRight size={16} />}
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-note">{children}</div>
    </article>
  );
}
export function Overview({
  data: d,
  onNavigate,
}: {
  data: Workspace;
  onNavigate: (v: View) => void;
}) {
  const m = d.metrics,
    meta = d.meta,
    f = d.cash.forecasts[3];
  const watch =
    meta?.days !== null && meta?.days !== undefined && meta.days < 3;
  return (
    <>
      <div className={`decision-brief ${watch ? "watch" : ""}`}>
        <div className="brief-icon">
          <Activity size={19} />
        </div>
        <div>
          <div className="eyebrow">THE OPERATOR BRIEF</div>
          <strong>
            {watch
              ? "A little attention now. More room to move later."
              : "A clear view starts with trusted inputs."}
          </strong>
          <p>
            {watch
              ? `Meta credit has ${meta.days!.toFixed(1)} days of headroom at the entered budget. Review payment clearing before scaling.`
              : d.mode === "demo"
                ? "Explore the demo workflow. Live balances, supplier prices and account mappings still need to be connected."
                : "Review data coverage and cash sources before making a financial decision."}
          </p>
        </div>
        <button className="text-button" onClick={() => onNavigate("scale")}>
          Review scenario <ArrowUpRight size={15} />
        </button>
      </div>
      <section className="metrics">
        <Metric label="Net revenue" value={amount(m.net, d.currency)}>
          <Badge>{d.mode === "demo" ? "DEMO" : "SOURCE RECORDS"}</Badge>{" "}
          {m.orders} source orders
        </Metric>
        <Metric label="True order COGS" value={amount(m.cogs, d.currency)}>
          {m.missingCosts ? (
            `${m.missingCosts} unmapped cost lines`
          ) : (
            <>
              <Badge>{d.mode === "demo" ? "DEMO" : "CALCULATED"}</Badge>{" "}
              Includes shipping & fulfillment
            </>
          )}
        </Metric>
        <Metric label="Advertising spend" value={amount(m.ads, d.currency)}>
          <Badge>{d.mode === "demo" ? "DEMO" : "PLATFORM / MANUAL"}</Badge>{" "}
          Actual spend · {d.days}D
        </Metric>
        <Metric
          label="Contribution profit"
          value={amount(m.profit, d.currency)}
          featured
        >
          {m.margin === null
            ? "Margin unavailable"
            : `${(m.margin * 100).toFixed(1)}% contribution margin`}{" "}
          · Fees included
        </Metric>
      </section>
      <div className="overview-grid">
        <section className="panel revenue-panel">
          <div className="panel-heading">
            <div>
              <h2>Performance, without the noise.</h2>
              <p>Net revenue & real order costs · {d.currency}</p>
            </div>
            <Badge>
              {d.days}D / {d.mode === "demo" ? "DEMO" : "DATA"}
            </Badge>
          </div>
          <div className="chart-legend">
            <span>
              <i className="legend-dot accent" />
              Net revenue
            </span>
            <span>
              <i className="legend-dot gray" />
              True COGS
            </span>
          </div>
          <div
            className="chart-container"
            role="img"
            aria-label={`Daily net revenue and true COGS in ${d.currency}; ${d.days} day range, ${d.mode} data.`}
          >
            <ResponsiveContainer
              width="100%"
              height="100%"
              initialDimension={{ width: 600, height: 235 }}
            >
              <AreaChart
                data={d.chart}
                margin={{ left: 4, right: 14, top: 10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0"
                      stopColor="var(--accent)"
                      stopOpacity={0.16}
                    />
                    <stop
                      offset="1"
                      stopColor="var(--accent)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#2A2C31" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(s) => day(s)}
                  tick={{ fill: "#A5A7B0", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={35}
                />
                <YAxis
                  tickFormatter={(n) => `${(n / 1000).toFixed(0)}k`}
                  tick={{ fill: "#A5A7B0", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={45}
                />
                <Tooltip
                  contentStyle={{
                    background: "#1D1F24",
                    border: "1px solid #454750",
                    borderRadius: 10,
                    color: "#F3F2EF",
                  }}
                  formatter={(v) => amount(Number(v) * 100, d.currency)}
                  labelFormatter={(s) => day(String(s))}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Net revenue"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  fill="url(#revenue-fill)"
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="cogs"
                  name="True COGS"
                  stroke="#9B9EA8"
                  strokeWidth={1.5}
                  fill="transparent"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="performance-bottom">
            <div>
              <span>True refunds</span>
              <strong>{amount(m.refunds, d.currency)}</strong>
            </div>
            <div>
              <span>Processing fees</span>
              <strong>{amount(m.fees, d.currency)}</strong>
            </div>
            <button className="text-button" onClick={() => onNavigate("costs")}>
              Trace the numbers <ArrowUpRight size={14} />
            </button>
          </div>
        </section>
        <section className="panel credit-panel">
          <div className="panel-heading">
            <h2>Meta credit</h2>
            <Badge tone={watch ? "warning" : "neutral"}>
              {meta ? (watch ? "Watch" : "Headroom") : "Unavailable"}
            </Badge>
          </div>
          {meta ? (
            <>
              <div className="eyebrow">ESTIMATED DAYS OF HEADROOM</div>
              <div className="headroom">
                {meta.days === null ? "—" : meta.days.toFixed(1)}
                <span>days</span>
              </div>
              <div className="credit-progress">
                <span
                  style={{
                    width: `${Math.min(100, Math.max(0, (meta.utilization || 0) * 100))}%`,
                  }}
                />
              </div>
              <div className="data-pair">
                <span>Credit utilization</span>
                <strong>
                  {meta.utilization === null
                    ? "Unavailable"
                    : `${(meta.utilization * 100).toFixed(0)}%`}
                </strong>
              </div>
              <div className="data-pair">
                <span>Available credit</span>
                <strong>{amount(meta.available, d.currency)}</strong>
              </div>
              <div className="data-pair">
                <span>Daily Meta budget</span>
                <strong>{amount(meta.dailySpend, d.currency)}</strong>
              </div>
              <div className="credit-callout">
                <Clock size={16} />
                <span>
                  Payment sent ≠ credit restored.
                  <br />
                  Clearing time matters.
                </span>
              </div>
              <p className="source-note">
                {meta.source} · Snapshot {day(meta.observedAt)} · Budget-based
                estimate
              </p>
            </>
          ) : (
            <Empty title="No credit snapshot">
              Enter or connect verified limits, debt and budget before
              forecasting headroom.
            </Empty>
          )}
        </section>
      </div>
      <section className="cash-strip">
        <div>
          <div className="eyebrow">CASH, LOOKING FORWARD</div>
          <h2>
            {amount(d.cash.opening, d.currency)} <span>available</span>
          </h2>
          <p>
            {d.cash.balances.length
              ? "Latest account snapshots · see dates below"
              : "No cash balance has been entered"}
          </p>
        </div>
        <div className="cash-horizons">
          {d.cash.forecasts.map((f) => (
            <div key={f.hours}>
              <span>{f.hours === 168 ? "7D" : `${f.hours}H`} OUTGOING</span>
              <strong>{amount(f.outgoing, d.currency)}</strong>
            </div>
          ))}
        </div>
        <button
          className="icon-button"
          aria-label="Open cash forecast"
          onClick={() => onNavigate("cash")}
        >
          <ArrowUpRight size={22} />
        </button>
      </section>
      <div className="overview-grid bottom-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>Coming up next</h2>
            <button className="text-button" onClick={() => onNavigate("cash")}>
              All obligations <ChevronRight size={14} />
            </button>
          </div>
          <ObligationsTable data={d} limit={4} />
        </section>
        <section className="panel outlook-panel">
          <div className="eyebrow">YOUR 7-DAY OUTLOOK</div>
          <h2>
            Room to operate.
            <br />
            Clarity to decide.
          </h2>
          <div className="data-pair">
            <span>Projected ending cash</span>
            <strong>{amount(f.ending, d.currency)}</strong>
          </div>
          <div className="data-pair">
            <span>
              {d.cash.bufferConfigured
                ? "Demo safety buffer"
                : "Buffer not configured"}
            </span>
            <strong>
              {d.cash.bufferConfigured
                ? amount(f.buffer, d.currency)
                : "Unavailable"}
            </strong>
          </div>
          <div className="outlook-foot">
            <Boxes size={18} />
            <p>
              Inventory coverage is unavailable.
              <br />
              Connect CJ before assessing stock risk.
            </p>
          </div>
        </section>
      </div>
      <details className="assumptions">
        <summary>
          <ShieldCheck size={14} /> Sources & calculation assumptions
        </summary>
        <ul>
          {d.assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
          <li>
            Cash forecast is shown per selected currency. No silent FX
            consolidation or cross-entity transfer assumptions.
          </li>
          <li>
            Source timestamps may be stale; the workspace as-of time is not a
            source refresh.
          </li>
        </ul>
      </details>
    </>
  );
}
function ObligationsTable({
  data: d,
  limit,
  onPaid,
}: {
  data: Workspace;
  limit?: number;
  onPaid?: (id: string) => void;
}) {
  const rows = d.obligations
    .filter((o) => (limit ? o.status === "SCHEDULED" : true))
    .slice(0, limit);
  return rows.length ? (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Obligation</th>
            <th>Due / UTC</th>
            <th>Status</th>
            <th className="numeric">Amount</th>
            {onPaid && <th>Action</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id}>
              <td>
                <strong>{o.title}</strong>
                <small>
                  {o.category} ·{" "}
                  {d.entities.find((e) => e.id === o.legal_entity_id)?.name}
                  {o.scope === "PERSONAL" ? " · PERSONAL / EXCLUDED" : ""}
                </small>
              </td>
              <td>{day(o.due_at)}</td>
              <td>
                <Badge
                  tone={
                    o.status === "PAID"
                      ? "success"
                      : new Date(o.due_at).getTime() < Date.now()
                        ? "warning"
                        : "neutral"
                  }
                >
                  {o.status === "PAID"
                    ? "Paid"
                    : new Date(o.due_at).getTime() < Date.now()
                      ? "Overdue"
                      : "Scheduled"}
                </Badge>
              </td>
              <td className="numeric">{amount(o.amount_minor, o.currency)}</td>
              {onPaid && (
                <td>
                  {o.status === "SCHEDULED" ? (
                    <button
                      className="text-button"
                      onClick={() => onPaid(o.id)}
                    >
                      Record paid
                    </button>
                  ) : (
                    "—"
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty title="No obligations in this view">
      Add a dated payment, tax obligation, salary or invoice to populate the
      forecast.
    </Empty>
  );
}
export function InvoiceList({
  data: d,
  onAdd,
}: {
  data: Workspace;
  onAdd: () => void;
}) {
  return (
    <>
      <div className="workflow-strip">
        {[
          "Upload original",
          "Enter & review",
          "Confirm totals",
          "Link cash obligation",
        ].map((s, i) => (
          <div key={s}>
            <span>{String(i + 1).padStart(2, "0")}</span>
            {s}
            {i < 3 && <ChevronRight size={14} />}
          </div>
        ))}
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Supplier invoices</h2>
            <p>Original evidence stays linked to every confirmed record.</p>
          </div>
          <button className="secondary" onClick={onAdd}>
            <Plus size={15} />
            Upload invoice
          </button>
        </div>
        {d.invoices.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Supplier / invoice</th>
                  <th>Invoice date</th>
                  <th>Cost effective</th>
                  <th>Status</th>
                  <th>Original</th>
                  <th className="numeric">Total</th>
                </tr>
              </thead>
              <tbody>
                {d.invoices.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <strong>{i.vendor}</strong>
                      <small>
                        {i.invoice_number} · {i.source}
                      </small>
                    </td>
                    <td>{day(i.invoice_date)}</td>
                    <td>{day(i.effective_date)}</td>
                    <td>
                      <Badge tone={i.status === "PAID" ? "success" : "neutral"}>
                        {i.status}
                      </Badge>
                    </td>
                    <td>
                      {i.attachment_id ? (
                        <a
                          className="text-button"
                          href={`/api/attachments/${i.attachment_id}`}
                        >
                          Download <ArrowDownLeft size={13} />
                        </a>
                      ) : (
                        "No attachment"
                      )}
                    </td>
                    <td className="numeric">
                      {amount(i.total_minor, i.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="The truth starts with the original.">
            Upload a sample invoice or screenshot, select the company and store,
            then review the item costs. AI extraction is not connected; entry is
            manual.
          </Empty>
        )}
      </section>
      <div className="info-note">
        <ShieldCheck size={17} />
        <p>
          Confirmation creates one invoice and one linked cash obligation.
          Creating a cost rule is optional and requires owner permission.
          Historical prices are never silently overwritten.
        </p>
      </div>
    </>
  );
}
export function Costs({ data: d }: { data: Workspace }) {
  const [product, setProduct] = useState("jar"),
    [quantity, setQuantity] = useState(2),
    [bundle, setBundle] = useState(2);
  const selected = d.products.filter(
    (p) => p.brand_id === d.stores.find((s) => s.id === d.storeId)?.brand_id,
  );
  const rule = d.costRules.find((r) => r.product_id === product);
  let result: ReturnType<typeof orderCost> | null = null;
  try {
    if (rule)
      result = orderCost(d.costRules, {
        productId: product,
        storeId: d.storeId,
        entityId: rule.legal_entity_id,
        quantity,
        bundleQuantity: bundle,
        date: d.asOf.slice(0, 10),
        currency: d.currency,
      });
  } catch {}
  return (
    <>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>True COGS rules</h2>
            <p>
              Prices are per bundle, not per physical unit. End dates are
              exclusive.
            </p>
          </div>
          <Badge>{d.costRules.length} RULES</Badge>
        </div>
        {d.costRules.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Bundle size</th>
                  <th>Product</th>
                  <th>Packaging</th>
                  <th>Fulfillment</th>
                  <th>Shipping</th>
                  <th>Effective</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {d.costRules.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>
                        {d.products.find((p) => p.id === r.product_id)?.name}
                      </strong>
                      <small>
                        v{r.version} · {r.id}
                      </small>
                    </td>
                    <td>{r.bundle_quantity} units</td>
                    <td>{amount(r.product_minor, r.currency)}</td>
                    <td>{amount(r.packaging_minor, r.currency)}</td>
                    <td>{amount(r.fulfillment_minor, r.currency)}</td>
                    <td>{amount(r.shipping_minor, r.currency)}</td>
                    <td>
                      {day(r.effective_start)} →{" "}
                      {r.effective_end ? day(r.effective_end) : "ongoing"}
                    </td>
                    <td>
                      <Badge>{r.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No confirmed costs yet">
            Missing prices remain unmapped, never zero. Enter reviewed invoice
            prices to create cost rules.
          </Empty>
        )}
      </section>
      {selected.length > 0 && (
        <section className="panel spaced">
          <div className="panel-heading">
            <h2>Try the bundle calculation</h2>
            <Badge>RULE-BASED</Badge>
          </div>
          <div className="calculator-grid">
            <label>
              Product
              <select
                value={product}
                onChange={(e) => setProduct(e.target.value)}
              >
                {selected.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Physical units
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </label>
            <label>
              Units per bundle
              <input
                type="number"
                min="1"
                value={bundle}
                onChange={(e) => setBundle(Number(e.target.value))}
              />
            </label>
            <div className="calc-result">
              <span>True order COGS</span>
              <strong>{amount(result?.total, d.currency)}</strong>
              <small>
                {result?.ruleId
                  ? `Rule ${result.ruleId}`
                  : result?.status || "No valid bundle match"}
              </small>
            </div>
          </div>
        </section>
      )}
      <section className="panel spaced">
        <div className="panel-heading">
          <h2>Order cost lineage</h2>
          <span className="subtle">First 20 lines in selected period</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Order line</th>
                <th>Product</th>
                <th>Units</th>
                <th>Rule</th>
                <th>Status</th>
                <th className="numeric">COGS</th>
              </tr>
            </thead>
            <tbody>
              {d.costs.slice(0, 20).map((c) => (
                <tr key={c.id}>
                  <td>{c.order_id}</td>
                  <td>{d.products.find((p) => p.id === c.product_id)?.name}</td>
                  <td>{c.quantity}</td>
                  <td>{c.ruleId || "Unmapped"}</td>
                  <td>
                    <Badge>{c.status}</Badge>
                  </td>
                  <td className="numeric">{amount(c.total, d.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
export function Cash({
  data: d,
  user,
  onAdd,
  onRefresh,
  onBalance,
}: {
  data: Workspace;
  user: User;
  onAdd: () => void;
  onRefresh: () => Promise<void>;
  onBalance: () => void;
}) {
  const [error, setError] = useState(""),
    [paidId, setPaidId] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  async function recordPaid() {
    if (!paidId) return;
    setBusy(true);
    try {
      await api("/api/obligations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: paidId, action: "record-paid" }),
      });
      setPaidId(null);
      await onRefresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="metrics">
        <Metric
          label="Available cash"
          value={amount(d.cash.opening, d.currency)}
        >
          Snapshot-based · not a real-time bank feed
        </Metric>
        <Metric
          label="7D incoming"
          value={amount(d.cash.forecasts[3].incoming, d.currency)}
        >
          Settlement schedule · estimated
        </Metric>
        <Metric
          label="7D outgoing"
          value={amount(d.cash.forecasts[3].outgoing, d.currency)}
        >
          Scheduled & overdue company obligations
        </Metric>
        <Metric
          label="7D ending cash"
          value={amount(d.cash.forecasts[3].ending, d.currency)}
          featured
        >
          Personal obligations excluded
        </Metric>
      </section>
      <section className="panel spaced">
        <div className="panel-heading">
          <div>
            <h2>Your cash horizon</h2>
            <p>
              Per {d.currency} · rolling forecast · outstanding overdue bills
              included
            </p>
          </div>
          <Badge>
            {d.cash.bufferConfigured ? "DEMO BUFFER" : "BUFFER NOT CONFIGURED"}
          </Badge>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Horizon</th>
                <th className="numeric">Incoming</th>
                <th className="numeric">Outgoing</th>
                <th className="numeric">Ending cash</th>
                <th className="numeric">Funding needed</th>
              </tr>
            </thead>
            <tbody>
              {d.cash.forecasts.map((f) => (
                <tr key={f.hours}>
                  <td>{f.hours === 168 ? "7 days" : `${f.hours} hours`}</td>
                  <td className="numeric">{amount(f.incoming, d.currency)}</td>
                  <td className="numeric">{amount(f.outgoing, d.currency)}</td>
                  <td className="numeric">{amount(f.ending, d.currency)}</td>
                  <td className="numeric">
                    {d.cash.bufferConfigured
                      ? amount(f.fundingNeeded, d.currency)
                      : "Buffer required"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel spaced">
        <div className="panel-heading">
          <h2>All obligations</h2>
          <button className="secondary" onClick={onAdd}>
            <Plus size={15} />
            Add obligation
          </button>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <ObligationsTable
          data={d}
          onPaid={(id) => {
            setPaidId(id);
            setError("");
          }}
        />
      </section>
      <div className="overview-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>Cash sources</h2>
            {user.role === "OWNER" && (
              <button className="text-button" onClick={onBalance}>
                <Plus size={14} />
                Record balance
              </button>
            )}
          </div>
          {d.cash.balances.length ? (
            d.cash.balances.map((b, i) => (
              <div className="balance-row" key={i}>
                <Wallet size={20} />
                <div>
                  <strong>{b.name}</strong>
                  <small>
                    {d.entities.find((e) => e.id === b.legal_entity_id)?.name} ·{" "}
                    {b.source} ·{" "}
                    {new Date(b.observed_at)
                      .toISOString()
                      .replace("T", " ")
                      .slice(0, 16)}{" "}
                    UTC
                  </small>
                </div>
                <strong>{amount(b.available_minor, d.currency)}</strong>
              </div>
            ))
          ) : (
            <p>
              No balance snapshots yet. Live balance entry will require
              confirmed account configuration.
            </p>
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Applications & subscriptions</h2>
            <Badge>REGISTRY</Badge>
          </div>
          {d.recurring.length ? (
            d.recurring.map((r) => (
              <div className="data-pair" key={r.id}>
                <div>
                  {r.vendor}
                  <small>
                    {r.frequency} · next due {day(r.next_due)} · {r.source}
                  </small>
                </div>
                <strong>{amount(r.amount_minor, r.currency)}</strong>
              </div>
            ))
          ) : (
            <p>No verified subscription registry yet.</p>
          )}
          <p className="source-note">
            No automatic app billing sync. Recurring schedules are stored;
            automatic future instance generation is not implemented.
          </p>
        </section>
      </div>
      <div className="info-note">
        <CalendarDays size={18} />
        <p>
          Track VAT, sales tax, payroll, owner taxes, distributions and
          dividends as explicit obligations. No rates, filing dates or
          liabilities are inferred. Recording a payment updates the liability;
          account balances remain manual snapshots.
        </p>
      </div>
      {paidId && (
        <Modal
          title="Record an existing payment"
          onClose={() => setPaidId(null)}
        >
          <p>
            This records a payment you already made. It does not move money or
            restore Meta credit. The obligation will leave future outflows;
            update your bank balance separately.
          </p>
          <div className="form-actions">
            <button className="secondary" onClick={() => setPaidId(null)}>
              Cancel
            </button>
            <button disabled={busy} className="primary" onClick={recordPaid}>
              Confirm payment record <Check size={16} />
            </button>
          </div>
          <p className="source-note">
            Actor: {user.name}. Change history is retained.
          </p>
        </Modal>
      )}
    </>
  );
}
