"use client";
import { useEffect, useState } from "react";
import type { Workspace } from "@/lib/workspace";
import { api, amount, Badge } from "./workspace-ui";
type Translation = {
  currency: string;
  total: number | null;
  assumption: string;
  accounts: {
    id: string;
    name: string;
    entity: string;
    currency: string;
    originalMinor: number;
    convertedMinor: number | null;
    rate: string | null;
    rateSource: string;
    rateObservedAt: string | null;
    observed_at: string;
  }[];
};
export function FxPanel({ data }: { data: Workspace }) {
  const [d, setData] = useState<Translation | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    api(
      `/api/fx?store=${data.storeId}&currency=${data.currency}&entity=${data.entityId || ""}`,
    )
      .then(setData)
      .catch((e) => setError(e.message));
  }, [data.storeId, data.currency, data.entityId]);
  return (
    <section className="panel spaced">
      <div className="panel-heading">
        <div>
          <h3>Cash translation & FX lineage</h3>
          <p>
            Original balances remain intact; only supplied direct rates are
            used.
          </p>
        </div>
        <Badge>TRANSLATED / MANUAL RATES</Badge>
      </div>
      {error && <div className="error-banner">{error}</div>}
      {d && (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Account / company</th>
                  <th>Original balance</th>
                  <th>{d.currency} translation</th>
                  <th>Rate / source</th>
                  <th>Observation</th>
                </tr>
              </thead>
              <tbody>
                {d.accounts.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {a.name}
                      <small>{a.entity}</small>
                    </td>
                    <td>{amount(a.originalMinor, a.currency)}</td>
                    <td>{amount(a.convertedMinor, d.currency)}</td>
                    <td>
                      {a.rate ?? "Unavailable"}
                      <small>{a.rateSource}</small>
                    </td>
                    <td>
                      {new Date(a.observed_at).toLocaleString()}
                      <small>
                        FX{" "}
                        {a.rateObservedAt
                          ? new Date(a.rateObservedAt).toLocaleString()
                          : "same currency / unavailable"}
                      </small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="data-pair">
            <span>Translated available total</span>
            <strong>{amount(d.total, d.currency)}</strong>
          </div>
          <p className="source-note">{d.assumption}</p>
        </>
      )}
    </section>
  );
}
