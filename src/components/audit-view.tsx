"use client";
import { useEffect, useState } from "react";
import { api, Badge, Empty } from "./workspace-ui";
import type { User } from "@/lib/auth";
type Log = {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  created_at: string;
  actor_id: string;
  previous_value: Record<string, unknown> | null;
  next_value: Record<string, unknown> | null;
};
export function AuditView({ user }: { user: User }) {
  const [logs, setLogs] = useState<Log[]>([]),
    [tables, setTables] = useState<string[]>([]),
    [table, setTable] = useState(""),
    [record, setRecord] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    if (user.role !== "OWNER") return;
    api(
      `/api/audit?${table ? "table=" + encodeURIComponent(table) : ""}${record ? "&record=" + encodeURIComponent(record) : ""}`,
    )
      .then((r) => {
        setLogs(r.records);
        setTables(r.tables);
        setError("");
      })
      .catch((e) => setError(e.message));
  }, [table, record, user.role]);
  if (user.role !== "OWNER")
    return (
      <Empty title="Owner access required">
        Financial audit history contains sensitive payroll, tax and owner
        records.
      </Empty>
    );
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Append-only change history</h2>
        <Badge>Latest 200 events</Badge>
      </div>
      <div className="filters">
        <label>
          Record family
          <select value={table} onChange={(e) => setTable(e.target.value)}>
            <option value="">All financial records</option>
            {tables.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          Exact record reference
          <input
            value={record}
            onChange={(e) => setRecord(e.target.value)}
            placeholder="Paste a source record ID"
          />
        </label>
      </div>
      {error && <div className="error-banner">{error}</div>}
      <div className="audit-list">
        {logs.map((log) => (
          <details key={log.id}>
            <summary>
              <span>
                <Badge>{log.action}</Badge>{" "}
                {log.table_name.replaceAll("_", " ")}
              </span>
              <span>{new Date(log.created_at).toLocaleString()}</span>
            </summary>
            <p>
              Record {log.record_id} · Actor {log.actor_id || "system"}
            </p>
            <div className="audit-diff">
              <div>
                <h3>Previous source record</h3>
                <pre>{JSON.stringify(log.previous_value, null, 2)}</pre>
              </div>
              <div>
                <h3>Resulting source record</h3>
                <pre>{JSON.stringify(log.next_value, null, 2)}</pre>
              </div>
            </div>
          </details>
        ))}
      </div>
      {!logs.length && (
        <Empty title="No matching changes">
          Updates append source records, preserved values and actor identity
          here.
        </Empty>
      )}
    </section>
  );
}
