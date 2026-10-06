import { randomUUID } from "node:crypto";
import type { Sql } from "./db";
import { appMode } from "./db";
import { HttpError } from "./auth";
import { integer } from "./finance";
export async function recordPayment(
  tx: Sql,
  input: {
    id: string;
    amount?: number;
    paidAt: string;
    reference: string;
    actor: string;
    owner: boolean;
    storeId?: string;
    entityId?: string;
    currency?: string;
  },
) {
  const o = (
    await tx.query<{
      amount_minor: string;
      status: string;
      category: string;
      scope: string;
      store_id: string;
      legal_entity_id: string;
      currency: string;
      invoice_id: string | null;
    }>("SELECT * FROM obligations WHERE id=$1 FOR UPDATE", [input.id])
  ).rows[0];
  if (!o) throw new HttpError(404, "Payment obligation not found");
  if (
    !input.owner &&
    (o.scope === "PERSONAL" ||
      /payroll|salary|tax|vat|dividend|distribution|owner|contribution/i.test(
        o.category,
      ))
  )
    throw new HttpError(403, "Owner permission required");
  if (
    (input.storeId && o.store_id !== input.storeId) ||
    (input.entityId && o.legal_entity_id !== input.entityId) ||
    (input.currency && o.currency !== input.currency)
  )
    throw new HttpError(400, "Payment context does not match the obligation");
  if (o.status !== "SCHEDULED")
    throw new HttpError(
      409,
      "This obligation has already been settled or cancelled",
    );
  if (Date.parse(input.paidAt) > Date.now() + 60000)
    throw new HttpError(400, "A recorded payment cannot be in the future");
  const paid = (
    await tx.query<{ amount: string | null }>(
      "SELECT sum(amount_minor) amount FROM obligation_payments WHERE obligation_id=$1",
      [input.id],
    )
  ).rows[0];
  const remaining = integer(o.amount_minor) - integer(paid.amount ?? 0),
    amount = input.amount ?? remaining;
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > remaining)
    throw new HttpError(
      400,
      "Payment exceeds the remaining liability or is not positive",
    );
  await tx.query(
    "INSERT INTO obligation_payments(id,obligation_id,amount_minor,paid_at,source,reference,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)",
    [
      randomUUID(),
      input.id,
      amount,
      input.paidAt,
      appMode() === "demo" ? "DEMO" : "MANUAL",
      input.reference,
      input.actor,
    ],
  );
  const settled = amount === remaining;
  await tx.query(
    "UPDATE obligations SET status=$2,paid_at=CASE WHEN $2='PAID' THEN $3::timestamptz ELSE paid_at END,updated_at=now() WHERE id=$1",
    [input.id, settled ? "PAID" : "SCHEDULED", input.paidAt],
  );
  if (settled && o.invoice_id)
    await tx.query(
      "UPDATE invoices SET status='PAID',payment_date=$2,updated_at=now() WHERE id=$1",
      [o.invoice_id, input.paidAt.slice(0, 10)],
    );
  return { settled, remaining: remaining - amount };
}
