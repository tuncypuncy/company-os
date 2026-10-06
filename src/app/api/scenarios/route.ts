import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireUser, sameOrigin, jsonBody, errorResponse } from "@/lib/auth";
import { getDb, actorTransaction } from "@/lib/db";
import { minor, integer, type CashEvent } from "@/lib/finance";
import { operationalWorkspace } from "@/lib/operational-workspace";
import { scaleDecision } from "@/lib/scale-decision";
const amount = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/)
  .transform(minor);
const schema = z
  .object({
    storeId: z.string().min(1),
    entityId: z.string().min(1).optional(),
    currency: z.enum(["USD", "EUR", "GBP"]),
    current: amount,
    proposed: amount,
    roas: z.coerce.number().min(0).max(100),
    cogs: z.coerce.number().min(0).max(100),
    refunds: z.coerce.number().min(0).max(100),
    fees: z.coerce.number().min(0).max(100),
    delay: z.coerce.number().min(0).max(365),
    supplierCash: z.coerce.number().min(0).max(100).nullable(),
    paymentMode: z.enum(["CREDIT", "DAILY_CASH", "UNKNOWN"]),
    warehouseId: z.string().optional(),
    billingId: z.string().optional(),
    routingConfirmed: z.boolean(),
    save: z.boolean().default(false),
  })
  .strict();
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser({ owner: true });
    const parsed = schema.safeParse(await jsonBody(request));
    if (!parsed.success)
      return Response.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    const v = parsed.data,
      op = await operationalWorkspace(v.storeId, v.currency, v.entityId, true),
      db = await getDb();
    const obligations = (
      await db.query<{
        id: string;
        amount_minor: string;
        currency: string;
        legal_entity_id: string;
        due_at: string;
        status: string;
        scope: string;
      }>(
        "SELECT * FROM obligations WHERE store_id=$1 AND currency=$2 AND ($3::text IS NULL OR legal_entity_id=$3)",
        [v.storeId, v.currency, v.entityId ?? null],
      )
    ).rows;
    const events: CashEvent[] = obligations.map((o) => ({
      id: o.id,
      amount: integer(o.amount_minor),
      currency: o.currency,
      entityId: o.legal_entity_id,
      dueAt: o.due_at,
      status: o.status,
      scope: o.scope,
    }));
    const inflows: CashEvent[] = op.tables.inflows.map((o) => ({
      id: String(o.id),
      amount: integer(o.amount_minor),
      currency: String(o.currency),
      entityId: String(o.legal_entity_id),
      dueAt: String(o.expected_at),
      status: String(o.status),
    }));
    const facility = op.facilities.find((f) => f.id === v.billingId);
    const balances = (
      await db.query<{ observed_at: string }>(
        "SELECT DISTINCT ON(b.account_id) b.observed_at FROM cash_balance_snapshots b JOIN cash_accounts a ON a.id=b.account_id WHERE a.store_id=$1 AND a.currency=$2 AND ($3::text IS NULL OR a.legal_entity_id=$3) ORDER BY b.account_id,b.observed_at DESC",
        [v.storeId, v.currency, v.entityId ?? null],
      )
    ).rows;
    const freshness = Number(op.settings?.freshness_hours ?? 24) * 3600000;
    const inventory = op.inventory
      .filter((i) => i.warehouse_id === v.warehouseId)
      .map((i) => ({
        sku: i.sku,
        available: i.available,
        daily: i.velocity,
        inbound: i.arrivals.map((a) => ({
          quantity: a.quantity,
          eta: a.eta,
          status: "IN_TRANSIT",
        })),
        fresh: i.freshness === "CURRENT",
      }));
    const results = scaleDecision({
      currentDaily: v.current,
      proposedDaily: v.proposed,
      roas: v.roas,
      cogsBps: Math.round(v.cogs * 100),
      refundBps: Math.round(v.refunds * 100),
      feeBps: Math.round(v.fees * 100),
      settlementDays: v.delay,
      opening: op.summary.opening,
      buffer: op.summary.buffer,
      availableCredit: facility?.available ?? null,
      clearingDays:
        facility?.clearing_days == null ? null : Number(facility.clearing_days),
      paymentMode: v.paymentMode,
      asOf: op.asOf,
      currency: v.currency,
      entityId: v.entityId,
      outflows: events,
      inflows,
      inventory,
      coverageComplete: v.routingConfirmed && op.mappingCoverage.complete,
      cashFresh:
        balances.length > 0 &&
        balances.every(
          (b) => Date.now() - Date.parse(b.observed_at) <= freshness,
        ),
      metaFresh: facility?.freshness === "CURRENT",
      supplierCashBps:
        v.supplierCash === null ? null : Math.round(v.supplierCash * 100),
    });
    let id: string | null = null;
    if (v.save) {
      id = randomUUID();
      await actorTransaction(user.id, async (tx) => {
        await tx.query(
          "INSERT INTO scenarios(id,store_id,legal_entity_id,currency,inputs,results,created_by,calculation_version) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,'v2.1')",
          [
            id,
            v.storeId,
            v.entityId ?? null,
            v.currency,
            JSON.stringify(v),
            JSON.stringify(results),
            user.id,
          ],
        );
      });
    }
    return Response.json({ id, ...results });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function GET(request: Request) {
  try {
    await requireUser({ owner: true });
    const p = new URL(request.url).searchParams;
    const r = await (
      await getDb()
    ).query(
      "SELECT * FROM scenarios WHERE store_id=$1 AND currency=$2 ORDER BY created_at DESC LIMIT 30",
      [p.get("store") || "gia", p.get("currency") || "USD"],
    );
    return Response.json(
      { scenarios: r.rows },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
