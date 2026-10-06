import { jsonBody } from "@/lib/auth";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { actorTransaction, appMode } from "@/lib/db";
import { requireUser, errorResponse, HttpError, sameOrigin } from "@/lib/auth";
import { recordPayment } from "@/lib/payments";
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
    await actorTransaction(user.id, (tx) =>
      recordPayment(tx, {
        id: parsed.data.id,
        paidAt: new Date().toISOString(),
        reference: "manual-full-" + randomUUID(),
        actor: user.id,
        owner: user.role === "OWNER",
      }),
    );
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
