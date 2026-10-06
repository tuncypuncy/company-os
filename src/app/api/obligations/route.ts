import { jsonBody } from "@/lib/auth";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { actorTransaction, appMode } from "@/lib/db";
import { requireUser, errorResponse, HttpError, sameOrigin } from "@/lib/auth";
import { obligationSchema } from "@/lib/validation";
export const runtime = "nodejs";
const restricted = [
  "Payroll",
  "Employer Contributions",
  "VAT",
  "Sales Tax",
  "Corporate Tax",
  "Payroll Tax",
  "Owner Tax",
  "Owner Salary",
  "Owner Draw",
  "Distribution",
  "Dividend",
];
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    const parsed = obligationSchema.safeParse(await jsonBody(request));
    if (!parsed.success)
      throw new HttpError(400, parsed.error.issues[0].message);
    const v = parsed.data;
    if (
      (v.scope === "PERSONAL" || restricted.includes(v.category)) &&
      user.role !== "OWNER"
    )
      throw new HttpError(
        403,
        "Owner permission required for payroll, tax or owner obligations",
      );
    const id = randomUUID();
    await actorTransaction(user.id, async (tx) => {
      const e = await tx.query("SELECT id FROM legal_entities WHERE id=$1", [
        v.entityId,
      ]);
      const s = await tx.query("SELECT id FROM stores WHERE id=$1", [
        v.storeId,
      ]);
      if (!e.rows.length || !s.rows.length)
        throw new HttpError(400, "Unknown company or store");
      await tx.query(
        "INSERT INTO obligations(id,legal_entity_id,store_id,title,category,currency,amount_minor,due_at,filing_date,period,jurisdiction,scope,status,source,verification_status,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'SCHEDULED',$13,$14,$15)",
        [
          id,
          v.entityId,
          v.storeId,
          v.title,
          v.category,
          v.currency,
          v.amount,
          `${v.dueDate}T23:59:59Z`,
          v.filingDate || null,
          v.period || null,
          v.jurisdiction || null,
          v.scope,
          appMode() === "demo" ? "DEMO" : "MANUAL",
          appMode() === "demo" ? "DEMO" : "CONFIRMED",
          user.id,
        ],
      );
    });
    return Response.json({ id }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    const parsed = z
      .object({ id: z.string().min(1), action: z.literal("record-paid") })
      .safeParse(await jsonBody(request));
    if (!parsed.success) throw new HttpError(400, "Invalid payment record");
    await actorTransaction(user.id, async (tx) => {
      const result = await tx.query<{
        category: string;
        scope: string;
        status: string;
        invoice_id: string | null;
      }>(
        "SELECT category,scope,status,invoice_id FROM obligations WHERE id=$1 FOR UPDATE",
        [parsed.data.id],
      );
      const record = result.rows[0];
      if (!record) throw new HttpError(404, "Payment obligation not found");
      if (
        (record.scope === "PERSONAL" || restricted.includes(record.category)) &&
        user.role !== "OWNER"
      )
        throw new HttpError(403, "Owner permission required");
      if (record.status !== "SCHEDULED")
        throw new HttpError(
          409,
          "This obligation has already been settled or cancelled",
        );
      await tx.query(
        "UPDATE obligations SET status='PAID',paid_at=now(),updated_at=now() WHERE id=$1",
        [parsed.data.id],
      );
      if (record.invoice_id)
        await tx.query(
          "UPDATE invoices SET status='PAID',payment_date=current_date,updated_at=now() WHERE id=$1",
          [record.invoice_id],
        );
    });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
