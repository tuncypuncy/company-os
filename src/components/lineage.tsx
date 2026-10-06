"use client";
import { useEffect, useState } from "react";
import { api, Badge } from "./workspace-ui";
import { Modal } from "./finance-forms";
export function Lineage({
  kind,
  id,
  onClose,
}: {
  kind: string;
  id: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<{
      record: unknown;
      related: Record<string, unknown[]>;
      audit: unknown[];
      methodology: string;
    } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    api(
      `/api/lineage?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`,
    )
      .then(setData)
      .catch((e) => setError(e.message));
  }, [kind, id]);
  return (
    <Modal title="Source evidence & calculation lineage" onClose={onClose}>
      <div className="finance-form">
        <Badge>
          {kind.toUpperCase()} · {id.slice(0, 12)}
        </Badge>
        {error && <div className="error-banner">{error}</div>}
        {data && (
          <>
            <p>{data.methodology}</p>
            {kind === "expenses" && (
              <ExpenseReceipt
                id={id}
                onSaved={async () =>
                  setData(
                    await api(
                      `/api/lineage?kind=expenses&id=${encodeURIComponent(id)}`,
                    ),
                  )
                }
              />
            )}
            {(data.related.attachments || []).map((a) => {
              const attachment = a as { id: string; original_name: string };
              return (
                <p key={attachment.id}>
                  <a href={`/api/attachments/${attachment.id}`}>
                    Download {attachment.original_name}
                  </a>
                </p>
              );
            })}
            <h3>Recorded source</h3>
            <pre className="lineage-json">
              {JSON.stringify(data.record, null, 2)}
            </pre>
            {Object.entries(data.related).map(([key, records]) => (
              <details key={key} open={key === "revisions"}>
                <summary>
                  {key.replaceAll("_", " ")} · {records.length} records
                </summary>
                <pre className="lineage-json">
                  {JSON.stringify(records, null, 2)}
                </pre>
              </details>
            ))}
            {data.audit.length > 0 && (
              <details>
                <summary>Audit history · {data.audit.length} changes</summary>
                <pre className="lineage-json">
                  {JSON.stringify(data.audit, null, 2)}
                </pre>
              </details>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

function ExpenseReceipt({
  id,
  onSaved,
}: {
  id: string;
  onSaved: () => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <section className="panel">
      <h3>Receipt evidence</h3>
      <p>
        Attach the original document to this expense. This does not create
        another liability.
      </p>
      <label>
        Receipt file
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          onChange={(e) => {
            setFile(e.target.files?.[0] || null);
            setConfirmed(false);
          }}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />{" "}
        I reviewed this receipt and confirmed it belongs to this expense.
      </label>
      {error && <p role="alert">{error}</p>}
      <button
        className="primary"
        disabled={!file || !confirmed || busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const form = new FormData();
            form.set("expenseId", id);
            form.set("file", file!);
            form.set("confirmed", "true");
            await api("/api/receipts", { method: "POST", body: form });
            setFile(null);
            setConfirmed(false);
            await onSaved();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Receipt upload failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Saving…" : "Attach reviewed receipt"}
      </button>
    </section>
  );
}
