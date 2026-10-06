"use client";
import { useEffect, useState, useCallback } from "react";
import { Plug, Plus, RefreshCw, ShieldCheck } from "lucide-react";
import type { Workspace } from "@/lib/workspace";
import type { User } from "@/lib/auth";
import { api, Badge, Empty } from "./workspace-ui";
import { AccessSettings } from "./access-settings";
import { Modal } from "./finance-forms";
type Connection = {
  id: string;
  platform: string;
  status: string;
  credentialsPresent: boolean;
  freshness: string;
  last_success_at: string | null;
  last_error: string | null;
  config: Record<string, unknown>;
  capabilities: Record<string, boolean>;
};
export function ConnectionSettings({
  data,
  user,
}: {
  data: Workspace;
  user: User;
}) {
  const [connections, setConnections] = useState<Connection[]>([]),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [platform, setPlatform] = useState(""),
    [busy, setBusy] = useState("");
  const load = useCallback(async () => {
    try {
      const r = await api("/api/connections?store=" + data.storeId);
      setConnections(r.connections);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection load failed");
    }
  }, [data.storeId]);
  useEffect(() => {
    let cancelled = false;
    api("/api/connections?store=" + data.storeId)
      .then((r) => {
        if (!cancelled) setConnections(r.connections);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [data.storeId]);
  async function act(id: string, action: string) {
    setBusy(id);
    setMessage("");
    setError("");
    try {
      const r = await api("/api/connections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      setMessage(
        r.records !== undefined
          ? `${r.records} source records processed. ${r.status}`
          : r.status,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection action failed");
    } finally {
      setBusy("");
      await load();
    }
  }
  return (
    <>
      <div className="decision-brief">
        <ShieldCheck size={20} />
        <div>
          <strong>Credentials stay on the server.</strong>
          <p>
            Configure account identities and secure variable names here. Saving
            configuration does not establish a live connection.
          </p>
        </div>
        <Badge>NOT CONNECTED until verified</Badge>
      </div>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      {message && <div className="success-banner">{message}</div>}
      <div className="action-grid">
        {user.role === "OWNER" &&
          ["Shopify", "Meta", "CJ"].map((p) => (
            <button
              className="secondary"
              key={p}
              onClick={() => setPlatform(p)}
            >
              <Plus size={14} />
              Configure {p}
            </button>
          ))}
        <button className="secondary" onClick={load}>
          <RefreshCw size={14} />
          Refresh status
        </button>
      </div>
      <div className="integration-grid">
        {connections.map((c) => (
          <section className="panel integration-card" key={c.id}>
            <div className="card-label">
              <Plug size={18} />
              {c.platform}
              <Badge
                tone={
                  c.status === "CONNECTED"
                    ? "success"
                    : c.status === "ERROR"
                      ? "danger"
                      : "neutral"
                }
              >
                {c.status.replaceAll("_", " ")}
              </Badge>
            </div>
            <h3>
              {String(
                c.config.shopDomain || c.config.accountId || "Supplier account",
              )}
            </h3>
            <p>
              Credential variable: {String(c.config.tokenEnv || "Unconfigured")}{" "}
              · {c.credentialsPresent ? "present" : "missing"}
            </p>
            <p>
              {c.last_success_at
                ? "Last ingestion " +
                  new Date(c.last_success_at).toLocaleString()
                : "No successful ingestion"}{" "}
              · {c.freshness}
            </p>
            <p className="source-note">
              Supported:{" "}
              {Object.entries(c.capabilities || {})
                .filter(([, v]) => v)
                .map(([k]) => k)
                .join(", ") || "verified profile required"}
            </p>
            {c.last_error && <p className="negative">{c.last_error}</p>}
            {c.platform === "Shopify" && (
              <p className="source-note">
                Webhook path: /api/webhooks/shopify/{c.id}
              </p>
            )}
            {user.role === "OWNER" && (
              <div className="action-grid">
                <button
                  className="secondary"
                  disabled={busy === c.id}
                  onClick={() => act(c.id, "check")}
                >
                  Verify access
                </button>
                <button
                  className="primary"
                  disabled={busy === c.id}
                  onClick={() => act(c.id, "sync")}
                >
                  Sync now
                </button>
                <button
                  className="secondary"
                  disabled={busy === c.id}
                  onClick={() => act(c.id, "disconnect")}
                >
                  Disconnect
                </button>
              </div>
            )}
          </section>
        ))}
      </div>
      {!connections.length && (
        <Empty title="Choose your first account connection">
          Shopify, Meta and CJ use independent store/account mappings. Add a
          configuration, set the referenced variables securely, then verify
          access and run a bounded sync.
        </Empty>
      )}
      <section className="panel spaced">
        <div className="panel-heading">
          <h2>Connection boundaries</h2>
        </div>
        <div className="attention-list">
          <div>
            <div>
              <b>Shopify: catalog, orders and platform refunds</b>
              <p>
                Signed webhooks queue idempotent events. The sync worker
                reconciles GraphQL records. Payouts and processor fees remain
                unavailable until their own source adapter is configured.
              </p>
            </div>
          </div>
          <div>
            <div>
              <b>Meta: actual spend and source ad-set budgets</b>
              <p>
                Ad-account spend caps and balances are not assumed to be credit
                facilities. Use the Meta billing module for reviewed credit,
                invoices and clearing.
              </p>
            </div>
          </div>
          <div>
            <div>
              <b>CJ: verified inventory profile or manual source data</b>
              <p>
                Current official CJ documentation is blocked by this
                environment’s network policy. Confirm endpoint, warehouse and
                available-stock semantics before API ingestion. Manual
                inventory, BOM and inbound flows are fully independent.
              </p>
            </div>
          </div>
        </div>
      </section>
      <AccessSettings user={user} />
      {platform && (
        <Modal title={"Configure " + platform} onClose={() => setPlatform("")}>
          <ConnectionForm
            platform={platform}
            data={data}
            onSaved={async () => {
              setPlatform("");
              setMessage(
                "Configuration saved as NOT CONNECTED. Set secure variables before verification.",
              );
              await load();
            }}
          />
        </Modal>
      )}
    </>
  );
}
function ConnectionForm({
  platform,
  data,
  onSaved,
}: {
  platform: string;
  data: Workspace;
  onSaved: () => Promise<void>;
}) {
  const [entity, setEntity] = useState(data.entityId || ""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [values, setValues] = useState({
      shopDomain: "",
      apiVersion: platform === "Shopify" ? "2026-10" : "",
      tokenEnv:
        platform === "Shopify"
          ? "SHOPIFY_ACCESS_TOKEN"
          : platform === "Meta"
            ? "META_ACCESS_TOKEN"
            : "CJ_ACCESS_TOKEN",
      webhookSecretEnv: "SHOPIFY_WEBHOOK_SECRET",
      accountId: "",
      supplierId: "",
      profile: "",
    }),
    [shipping, setShipping] = useState(false);
  const fields =
    platform === "Shopify"
      ? [
          ["shopDomain", "Exact *.myshopify.com identity"],
          ["apiVersion", "Admin API version"],
          ["tokenEnv", "Server-side access-token variable"],
          ["webhookSecretEnv", "Webhook signing-secret variable"],
        ]
      : platform === "Meta"
        ? [
            ["accountId", "Ad account ID (act_...)"],
            ["apiVersion", "Supported Graph API version (v...)"],
            ["tokenEnv", "Server-side access-token variable"],
          ]
        : [
            ["supplierId", "Supplier record ID"],
            ["tokenEnv", "Server-side CJ access-token variable"],
          ];
  return (
    <form
      className="finance-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          const config =
            platform === "Shopify"
              ? {
                  shopDomain: values.shopDomain,
                  apiVersion: values.apiVersion,
                  tokenEnv: values.tokenEnv,
                  webhookSecretEnv: values.webhookSecretEnv,
                  entityId: entity,
                  includeShipping: shipping,
                }
              : platform === "Meta"
                ? {
                    accountId: values.accountId,
                    apiVersion: values.apiVersion,
                    tokenEnv: values.tokenEnv,
                    entityId: entity,
                  }
                : {
                    tokenEnv: values.tokenEnv,
                    entityId: entity,
                    supplierId: values.supplierId,
                    ...(values.profile
                      ? { verifiedProfile: JSON.parse(values.profile) }
                      : {}),
                  };
          await api("/api/connections", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ platform, storeId: data.storeId, config }),
          });
          await onSaved();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Invalid connection");
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="form-intro">
        {data.stores.find((s) => s.id === data.storeId)?.name} · Account mapping
        must be confirmed. Enter variable names, never credential values.
      </p>
      <label>
        Responsible entity
        <select
          required
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
        >
          <option value="">Select confirmed entity…</option>
          {data.entities.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </label>
      <div className="form-grid">
        {fields.map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              required
              value={values[key as keyof typeof values]}
              onChange={(e) =>
                setValues((v) => ({ ...v, [key]: e.target.value }))
              }
            />
          </label>
        ))}
      </div>
      {platform === "Shopify" && (
        <label className="checkbox">
          <input
            type="checkbox"
            checked={shipping}
            onChange={(e) => setShipping(e.target.checked)}
          />
          Include shipping revenue in managerial gross sales (tax remains
          excluded).
        </label>
      )}
      {platform === "CJ" && (
        <label>
          Verified official inventory profile JSON (optional)
          <textarea
            value={values.profile}
            onChange={(e) =>
              setValues((v) => ({ ...v, profile: e.target.value }))
            }
            placeholder="See docs/INTEGRATION_SETUP.md; leave empty until verified."
          />
        </label>
      )}
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      <div className="modal-actions">
        <button className="primary" disabled={busy}>
          Save as not connected
        </button>
      </div>
    </form>
  );
}
