"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Boxes,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  LayoutDashboard,
  LogOut,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Wallet,
  X,
  AlertTriangle,
  Plug,
  Menu,
  CalendarDays,
  Receipt,
  LoaderCircle,
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

import { ConnectionSettings } from "./connection-settings";
import { DecisionSimulator } from "./decision-simulator";
import { AuditView } from "./audit-view";
import { OperationsPanel } from "./operations-panel";
import { api, Badge, type View } from "./workspace-ui";
import {
  Overview,
  InvoiceList,
  Costs,
  Cash,
  Scale,
  Inventory,
  Connections,
} from "./workspace-views";
import {
  Modal,
  InvoiceForm,
  ObligationForm,
  BalanceForm,
} from "./finance-forms";
const nav = [
  ["overview", "Overview", LayoutDashboard],
  ["costs", "Commerce & COGS", BarChart3],
  ["cash", "Cash & obligations", Wallet],
  ["invoices", "Invoice center", Receipt],
  ["scale", "Can we scale?", SlidersHorizontal],
  ["inventory", "Inventory & supply", Boxes],
  ["expenses", "Expenses & payroll", CalendarDays],
  ["prepaid", "Prepaid pools", Boxes],
  ["meta", "Meta billing", Activity],
  ["audit", "Audit & lineage", ShieldCheck],
  ["integrations", "Connections", Plug],
] as const;
export function WorkspaceApp({
  user,
  mode,
}: {
  user: User;
  mode: "demo" | "live";
}) {
  const [view, setView] = useState<View>("overview"),
    [store, setStore] = useState("gia"),
    [currency, setCurrency] = useState("USD"),
    [days, setDays] = useState(7),
    [entity, setEntity] = useState("");
  const [data, setData] = useState<Workspace | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [modal, setModal] = useState<"invoice" | "obligation" | "balance" | null>(
      null,
    ),
    [mobile, setMobile] = useState(false),
    [toast, setToast] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(
        await api(
          `/api/workspace?store=${store}&currency=${currency}&days=${days}&entity=${entity}`,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load workspace");
    } finally {
      setLoading(false);
    }
  }, [store, currency, days, entity]);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api(
      `/api/workspace?store=${store}&currency=${currency}&days=${days}&entity=${entity}`,
    )
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [store, currency, days, entity]);
  const configuredAccent = data?.stores.find(
    (s) => s.id === store,
  )?.accent_color;
  const accent =
    configuredAccent ||
    (store === "gia-usa"
      ? "#877AF5"
      : store === "faucet"
        ? "#C3C8D2"
        : "#FFD602");
  const soft =
    store === "gia-usa"
      ? "#CEC8FF"
      : store === "faucet"
        ? "#E1E4EA"
        : "#FFF2AD";
  const activeStore = data?.stores.find((s) => s.id === store);
  const choose = (v: View) => {
    setView(v);
    setMobile(false);
    setToast("");
  };
  return (
    <div
      className={`app-shell ${mobile ? "nav-open" : ""}`}
      style={
        {
          "--accent": accent,
          "--soft": soft,
          "--tint":
            store === "gia-usa"
              ? "#1E1A30"
              : store === "faucet"
                ? "#212328"
                : "#24200E",
        } as React.CSSProperties
      }
    >
      <aside className="sidebar">
        <a href="/" className="wordmark">
          company<span>/</span>os<span className="version">01</span>
        </a>
        <div className="workspace-label">
          <span className="workspace-avatar">OS</span>
          <div>
            Your workspace<small>Financial & operational control</small>
          </div>
        </div>
        <div className="nav-label">CONTROL TOWER</div>
        <nav>
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              className={view === id ? "active" : ""}
              onClick={() => choose(id)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {view === id && <ChevronRight size={14} />}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="private-label">
            <ShieldCheck size={14} /> Private workspace
          </div>
          <div className="user">
            <span className="user-avatar">{user.name.slice(0, 1)}</span>
            <div>
              {user.name}
              <small>
                {mode === "demo"
                  ? "Demo access"
                  : user.role.replaceAll("_", " ").toLowerCase()}
              </small>
            </div>
            <button
              aria-label="Sign out"
              className="icon-button"
              onClick={async () => {
                await api("/api/session", { method: "DELETE" });
                location.reload();
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Toggle navigation"
              aria-expanded={mobile}
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={20} />
            </button>
            <div className="store-select">
              <span className="store-dot" />
              <label className="sr-only" htmlFor="store">
                Store
              </label>
              <select
                id="store"
                value={store}
                onChange={(e) => setStore(e.target.value)}
              >
                {(
                  data?.stores || [
                    { id: "gia", name: "Godisabove" },
                    { id: "gia-usa", name: "Godisabove USA" },
                    { id: "faucet", name: "360 Faucet" },
                  ]
                ).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} />
            </div>
            <span className="topbar-divider" />
            <span className="subtle topbar-subtitle">
              {nav.find((n) => n[0] === view)?.[1]}
            </span>
          </div>
          <div className="topbar-right">
            <Badge tone={mode === "demo" ? "demo" : "neutral"}>
              {mode === "demo" ? "DEMO WORKSPACE" : "PRIVATE · LIVE MODE"}
            </Badge>
            <span className="subtle topbar-subtitle">v0.1</span>
          </div>
        </header>
        <main className="main-content">
          <div className="page-title">
            <div>
              <div className="eyebrow">
                {activeStore?.name || "Your workspace"} /{" "}
                {view === "overview" ? "THE BIG PICTURE" : "CONTROL TOWER"}
              </div>
              <h1>
                {
                  {
                    expenses: "Every cost under control.",
                    prepaid: "Turn upfront costs into clarity.",
                    meta: "Keep your credit moving.",
                    audit: "Follow the financial trail.",
                    overview: "Your business. In focus.",
                    invoices: "From invoice to insight.",
                    costs: "The real cost of every order.",
                    cash: "Know what comes next.",
                    scale: "Make your next move.",
                    inventory: "Stay ahead of demand.",
                    integrations: "Connect the whole picture.",
                  }[view]
                }
              </h1>
              <p>
                {
                  {
                    expenses: "Contracts, recognition, payroll and renewals.",
                    prepaid: "Consumption, remaining value and payment timing.",
                    meta: "Credit headroom, payment stages and cash-aware suggestions.",
                    audit: "Source evidence, revisions and responsible actors.",
                    overview:
                      "Your economics, cash and next decisions. All in one place.",
                    invoices:
                      "Upload, review and confirm. Every cost has a source.",
                    costs:
                      "Bundle-aware pricing. Historical truth. No hidden assumptions.",
                    cash: "Cash today. Obligations tomorrow. No surprises.",
                    scale: "Explore the upside. Understand the constraints.",
                    inventory:
                      "Physical stock, supplier mappings and inbound visibility.",
                    integrations:
                      "Real connections, explicit capabilities and clear provenance.",
                  }[view]
                }
              </p>
            </div>
            <button
              className="primary"
              onClick={() =>
                setModal(view === "cash" ? "obligation" : "invoice")
              }
            >
              <Plus size={16} />
              {view === "cash" ? "Add obligation" : "Add invoice"}
            </button>
          </div>
          <div className="filters">
            <div className="segment" aria-label="Date range">
              {[
                [1, "Today"],
                [7, "7 days"],
                [30, "30 days"],
              ].map(([d, label]) => (
                <button
                  key={d}
                  className={days === d ? "selected" : ""}
                  onClick={() => setDays(Number(d))}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="filter-select">
              <span className="sr-only">Legal entity</span>
              <select
                value={entity}
                onChange={(e) => setEntity(e.target.value)}
              >
                <option value="">All entities</option>
                {data?.entities.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-select">
              <span className="sr-only">Currency</span>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {["USD", "EUR", "GBP"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <span className="filter-time">
              <Clock size={13} />
              {data
                ? `As of ${new Date(data.asOf).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`
                : "Loading…"}
            </span>
          </div>
          {mode === "demo" && (
            <div className="demo-banner">
              <span className="demo-dot" />
              <span>
                <strong>Demo, not your books.</strong> All values and account
                attribution are fictional. Don’t upload real financial
                documents.
              </span>
            </div>
          )}
          {toast && (
            <div className="success-banner" role="status">
              <Check size={16} />
              {toast}
            </div>
          )}
          {error ? (
            <div className="error-banner" role="alert">
              {error}
              <button className="secondary" onClick={refresh}>
                Try again
              </button>
            </div>
          ) : loading ? (
            <div className="loading" role="status">
              <LoaderCircle size={22} className="spinner" /> Loading your
              control tower…
            </div>
          ) : (
            data && (
              <>
                {view === "overview" && (
                  <Overview data={data} onNavigate={choose} />
                )}
                {view === "invoices" && (
                  <InvoiceList data={data} onAdd={() => setModal("invoice")} />
                )}
                {view === "costs" && (
                  <>
                    <Costs data={data} />
                    <OperationsPanel
                      section="commerce"
                      data={data}
                      user={user}
                      onRefresh={refresh}
                    />
                  </>
                )}
                {view === "cash" && (
                  <Cash
                    data={data}
                    user={user}
                    onAdd={() => setModal("obligation")}
                    onRefresh={refresh}
                    onBalance={() => setModal("balance")}
                  />
                )}
                {view === "cash" && (
                  <OperationsPanel
                    section="cash"
                    data={data}
                    user={user}
                    onRefresh={refresh}
                  />
                )}
                {view === "scale" && (
                  <DecisionSimulator data={data} user={user} />
                )}
                {view === "audit" && <AuditView user={user} />}
                {view === "inventory" && (
                  <OperationsPanel
                    section="inventory"
                    data={data}
                    user={user}
                    onRefresh={refresh}
                  />
                )}
                {["expenses", "prepaid", "meta"].includes(view) && (
                  <OperationsPanel
                    section={view}
                    data={data}
                    user={user}
                    onRefresh={refresh}
                  />
                )}
                {view === "integrations" && (
                  <ConnectionSettings data={data} user={user} />
                )}
                <footer className="main-footer">
                  <span>
                    Company OS <span className="footer-slash">/</span> Built for
                    decisions.
                  </span>
                  <span>
                    {currency} · UTC ·{" "}
                    {mode === "demo"
                      ? "DEMO DATA"
                      : "MANUAL / CONFIGURED SOURCES"}
                  </span>
                </footer>
              </>
            )
          )}
        </main>
      </div>
      {modal && data && (
        <Modal
          title={
            modal === "invoice"
              ? "Add supplier invoice"
              : modal === "balance"
                ? "Record a cash balance"
                : "Schedule an obligation"
          }
          onClose={() => setModal(null)}
        >
          {modal === "invoice" ? (
            <InvoiceForm
              data={data}
              user={user}
              onSaved={async () => {
                setModal(null);
                setToast(
                  "Invoice confirmed. One linked payment obligation created.",
                );
                await refresh();
              }}
            />
          ) : modal === "balance" ? (
            <BalanceForm
              data={data}
              onSaved={async () => {
                setModal(null);
                setToast(
                  "New balance snapshot saved. Previous values retained.",
                );
                await refresh();
              }}
            />
          ) : (
            <ObligationForm
              data={data}
              user={user}
              onSaved={async () => {
                setModal(null);
                setToast("Obligation saved. Cash forecast updated.");
                await refresh();
              }}
            />
          )}
        </Modal>
      )}
    </div>
  );
}
