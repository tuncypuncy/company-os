import { jsonBody } from "@/lib/auth";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { actorTransaction, appMode } from "@/lib/db";
import { requireUser, sameOrigin, HttpError, errorResponse } from "@/lib/auth";
import { minor } from "@/lib/finance";
export const runtime = "nodejs";
const schema = z.object({
  entityId: z.string().min(1),
  storeId: z.string().min(1),
  accountName: z.string().trim().min(1).max(120),
  currency: z.enum(["USD", "EUR", "GBP"]),
  available: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .transform(minor),
  observedAt: z.iso.datetime(),
});
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser({ owner: true });
    const parsed = schema.safeParse(await jsonBody(request));
    if (!parsed.success)
      throw new HttpError(400, parsed.error.issues[0].message);
    const v = parsed.data;
    if (Date.parse(v.observedAt) > Date.now() + 60000)
      throw new HttpError(400, "Balance observation cannot be in the future");
    await actorTransaction(user.id, async (tx) => {
      const result = await tx.query<{ id: string }>(
        "SELECT id FROM cash_accounts WHERE legal_entity_id=$1 AND store_id=$2 AND currency=$3 AND name=$4",
        [v.entityId, v.storeId, v.currency, v.accountName],
      );
      const account = result.rows[0]?.id || randomUUID();
      if (!result.rows.length)
        await tx.query(
          "INSERT INTO cash_accounts(id,legal_entity_id,store_id,currency,name) VALUES($1,$2,$3,$4,$5)",
          [account, v.entityId, v.storeId, v.currency, v.accountName],
        );
      await tx.query(
        "INSERT INTO cash_balance_snapshots(id,account_id,available_minor,source,status,observed_at) VALUES($1,$2,$3,$4,$5,$6)",
        [
          randomUUID(),
          account,
          v.available,
          appMode() === "demo" ? "DEMO" : "MANUAL",
          appMode() === "demo" ? "DEMO" : "CONFIRMED",
          v.observedAt,
        ],
      );
    });
    return Response.json({ ok: true }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
