"use client";
import { useState, useEffect } from "react";
import { FileText, Plus, Check, X } from "lucide-react";
import type { User } from "@/lib/auth";
import type { Workspace } from "@/lib/workspace";
import { minor } from "@/lib/finance";
import { categories } from "@/lib/validation";
import { amount, api, Badge } from "./workspace-ui";
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = document.getElementById("dialog");
    dialog?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && dialog) {
        const nodes = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            "button:not([disabled]),input,select,textarea,a[href]",
          ),
        ).filter((n) => n.offsetParent !== null);
        const first = nodes[0],
          last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop">
      <section
        className="modal"
        id="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        tabIndex={-1}
      >
        <header className="modal-header">
          <h2 id="dialog-title">{title}</h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
const today = () => new Date().toISOString().slice(0, 10);
const zeroLine = (productId = "") => ({
  productId,
  bundles: 1,
  bundleQuantity: 2,
  product: "0",
  packaging: "0",
  fulfillment: "0",
  shipping: "0",
  other: "0",
});
export function InvoiceForm({
  data: d,
  user,
  onSaved,
}: {
  data: Workspace;
  user: User;
  onSaved: () => Promise<void>;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [file, setFile] = useState<File | null>(null),
    [review, setReview] = useState(false),
    [createRules, setCreateRules] = useState(false);
  const products = d.products.filter(
    (p) => p.brand_id === d.stores.find((s) => s.id === d.storeId)?.brand_id,
  );
  const [items, setItems] = useState([zeroLine(products[0]?.id)]);
  let total: number | null = null;
  try {
    total = items.reduce(
      (a, i) =>
        a +
        i.bundles *
          (minor(i.product) +
            minor(i.packaging) +
            minor(i.fulfillment) +
            minor(i.shipping) +
            minor(i.other)),
      0,
    );
  } catch {}
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const payload = {
      vendor: f.get("vendor"),
      invoiceNumber: f.get("invoiceNumber"),
      entityId: f.get("entityId"),
      storeId: d.storeId,
      currency: d.currency,
      invoiceDate: f.get("invoiceDate"),
      effectiveDate: f.get("effectiveDate"),
      dueDate: f.get("dueDate"),
      total: f.get("total"),
      notes: f.get("notes"),
      confirmed: review,
      createRules,
      items,
    };
    const form = new FormData();
    form.set("data", JSON.stringify(payload));
    if (file) form.set("file", file);
    try {
      await api("/api/invoices", { method: "POST", body: form });
      await onSaved();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <div className="form-intro">
        <Badge>{d.mode === "demo" ? "DEMO ONLY" : "MANUAL ENTRY"}</Badge>
        <p>
          AI extraction is not connected. Enter the invoice details, verify the
          source, then explicitly confirm.
        </p>
      </div>
      <label className="upload-zone">
        <FileText size={25} />
        <strong>{file ? file.name : "Choose invoice or screenshot"}</strong>
        <span>PDF, JPG or PNG · up to 10 MB · original retained privately</span>
        <input
          type="file"
          accept="application/pdf,image/png,image/jpeg"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      </label>
      <div className="form-grid">
        <label>
          Supplier / vendor
          <input
            name="vendor"
            required
            maxLength={120}
            placeholder="Supplier name"
          />
        </label>
        <label>
          Invoice number
          <input
            name="invoiceNumber"
            required
            maxLength={100}
            placeholder="Invoice reference"
          />
        </label>
        <label>
          Legal entity
          <select
            aria-label="Legal entity"
            name="entityId"
            defaultValue=""
            required
          >
            <option value="" disabled>
              Select company explicitly
            </option>
            {d.entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Store & currency
          <input
            readOnly
            value={`${d.stores.find((s) => s.id === d.storeId)?.name} · ${d.currency}`}
          />
        </label>
        <label>
          Invoice date
          <input
            type="date"
            name="invoiceDate"
            required
            defaultValue={today()}
          />
        </label>
        <label>
          Cost effective date
          <input
            type="date"
            name="effectiveDate"
            required
            defaultValue={today()}
          />
        </label>
        <label>
          Payment due date
          <input type="date" name="dueDate" required defaultValue={today()} />
        </label>
        <label>
          Invoice total ({d.currency})
          <input name="total" required inputMode="decimal" placeholder="0.00" />
        </label>
      </div>
      <div className="panel-heading line-heading">
        <h3>Reviewed cost lines</h3>
        <button
          type="button"
          className="text-button"
          onClick={() => setItems([...items, zeroLine(products[0]?.id)])}
        >
          <Plus size={14} />
          Add line
        </button>
      </div>
      <p className="source-note">
        Amounts are per bundle. Line total = number of bundles × all cost
        components.
      </p>
      {items.map((item, index) => (
        <div className="invoice-line" key={index}>
          <div className="form-grid">
            <label>
              Product
              <select
                aria-label="Product"
                required
                value={item.productId}
                onChange={(e) =>
                  setItems(
                    items.map((i, j) =>
                      j === index ? { ...i, productId: e.target.value } : i,
                    ),
                  )
                }
              >
                <option value="">Select product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="inline-fields">
              {(["bundles", "bundleQuantity"] as const).map((k) => (
                <label key={k}>
                  {k === "bundles" ? "Number of bundles" : "Units per bundle"}
                  <input
                    type="number"
                    min="1"
                    max={k === "bundles" ? 1000000 : 1000}
                    required
                    value={item[k]}
                    onChange={(e) =>
                      setItems(
                        items.map((i, j) =>
                          j === index
                            ? { ...i, [k]: Number(e.target.value) }
                            : i,
                        ),
                      )
                    }
                  />
                </label>
              ))}
            </div>
          </div>
          <div className="component-fields">
            {(
              [
                "product",
                "packaging",
                "fulfillment",
                "shipping",
                "other",
              ] as const
            ).map((k) => (
              <label key={k}>
                {k === "product"
                  ? "Product cost"
                  : k.charAt(0).toUpperCase() + k.slice(1)}
                <input
                  required
                  inputMode="decimal"
                  value={item[k]}
                  onChange={(e) =>
                    setItems(
                      items.map((i, j) =>
                        j === index ? { ...i, [k]: e.target.value } : i,
                      ),
                    )
                  }
                />
              </label>
            ))}
          </div>
          {items.length > 1 && (
            <button
              type="button"
              className="text-button danger"
              onClick={() => setItems(items.filter((_, j) => j !== index))}
            >
              Remove line
            </button>
          )}
        </div>
      ))}
      <div className="review-total">
        <span>Calculated line total</span>
        <strong>{amount(total, d.currency)}</strong>
      </div>
      <label>
        Notes
        <textarea
          name="notes"
          maxLength={2000}
          rows={2}
          placeholder="Allocation context or source notes. Never enter credentials."
        />
      </label>
      {user.role === "OWNER" && (
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={createRules}
            onChange={(e) => setCreateRules(e.target.checked)}
          />
          <span>
            Create effective-dated cost rules from these prices. Overlapping
            rules are rejected; historical prices remain intact.
          </span>
        </label>
      )}
      <label className="checkbox-label">
        <input
          type="checkbox"
          required
          checked={review}
          onChange={(e) => setReview(e.target.checked)}
        />
        <span>
          I reviewed the dates, company, store, product mappings and totals.
          Confirm this invoice and its linked payment obligation.
        </span>
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <span className="source-note">
          {file
            ? "Original file will be stored."
            : "Posting without an original attachment."}
        </span>
        <button className="primary" disabled={busy || !products.length}>
          {busy ? "Saving…" : "Confirm invoice"}
          <Check size={16} />
        </button>
      </div>
    </form>
  );
}
export function ObligationForm({
  data: d,
  user,
  onSaved,
}: {
  data: Workspace;
  user: User;
  onSaved: () => Promise<void>;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      await api("/api/obligations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...Object.fromEntries(f),
          storeId: d.storeId,
          currency: d.currency,
        }),
      });
      await onSaved();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <p>
        Enter a known obligation. No tax amount or deadline will be inferred.
        Personal obligations are tracked separately and excluded from company
        cash forecasts.
      </p>
      <div className="form-grid">
        <label>
          Description
          <input
            name="title"
            required
            maxLength={150}
            placeholder="Payment or filing obligation"
          />
        </label>
        <label>
          Category
          <select aria-label="Category" name="category">
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Legal entity
          <select
            aria-label="Legal entity"
            name="entityId"
            required
            defaultValue=""
          >
            <option value="" disabled>
              Select company
            </option>
            {d.entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Scope
          <select aria-label="Scope" name="scope">
            <option value="COMPANY">Company obligation</option>
            {user.role === "OWNER" && (
              <option value="PERSONAL">
                Owner personal · excluded from cash
              </option>
            )}
          </select>
        </label>
        <label>
          Amount ({d.currency})
          <input
            name="amount"
            required
            inputMode="decimal"
            placeholder="0.00"
          />
        </label>
        <label>
          Payment due date (UTC)
          <input type="date" name="dueDate" required defaultValue={today()} />
        </label>
        <label>
          Filing deadline (optional)
          <input type="date" name="filingDate" />
        </label>
        <label>
          Period (optional)
          <input name="period" maxLength={100} placeholder="e.g. 2026 Q3" />
        </label>
        <label>
          Jurisdiction (optional)
          <input
            name="jurisdiction"
            maxLength={100}
            placeholder="Only if confirmed"
          />
        </label>
        <label>
          Store
          <input
            readOnly
            value={d.stores.find((s) => s.id === d.storeId)?.name}
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="form-actions">
        <span className="source-note">No payment will be initiated.</span>
        <button disabled={busy} className="primary">
          {busy ? "Saving…" : "Save obligation"}
          <Check size={16} />
        </button>
      </div>
    </form>
  );
}

export function BalanceForm({
  data: d,
  onSaved,
}: {
  data: Workspace;
  onSaved: () => Promise<void>;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      await api("/api/balances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...Object.fromEntries(f),
          storeId: d.storeId,
          currency: d.currency,
          observedAt: new Date().toISOString(),
        }),
      });
      await onSaved();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <p>
        Record the current available balance from a verified source. Use the
        exact existing account name to add a new snapshot to that account.
        Previous snapshots remain in history. Separate real bank accounts must
        have distinct names.
      </p>
      <div className="form-grid">
        <label>
          Legal entity
          <select
            aria-label="Legal entity"
            name="entityId"
            required
            defaultValue=""
          >
            <option value="" disabled>
              Select company
            </option>
            {d.entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Account name
          <input
            name="accountName"
            required
            list="cash-account-names"
            maxLength={120}
          />
          <datalist id="cash-account-names">
            {d.cash.balances.map((b, i) => (
              <option key={i} value={b.name} />
            ))}
          </datalist>
        </label>
        <label>
          Available balance ({d.currency})
          <input
            name="available"
            required
            inputMode="decimal"
            placeholder="0.00"
          />
        </label>
        <label>
          Store
          <input
            readOnly
            value={d.stores.find((s) => s.id === d.storeId)?.name}
          />
        </label>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <span className="source-note">
          Observed now · UTC · no bank connection
        </span>
        <button className="primary" disabled={busy}>
          {busy ? "Saving…" : "Save balance snapshot"}
          <Check size={16} />
        </button>
      </div>
    </form>
  );
}
