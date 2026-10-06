"use client";
import { FileText } from "lucide-react";
export type View =
  | "overview"
  | "invoices"
  | "costs"
  | "cash"
  | "scale"
  | "inventory"
  | "integrations";
export function amount(n: unknown, currency = "USD") {
  return n === null || n === undefined
    ? "Unavailable"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
        minimumFractionDigits: 0,
      }).format(Number(n) / 100);
}
export function day(s: string) {
  return new Date(s).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
export async function api(url: string, options?: RequestInit) {
  const r = await fetch(url, options);
  const b = await r.json();
  if (!r.ok) throw Error(b.error || "Request failed");
  return b;
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <FileText size={25} />
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
