import { z } from "zod";
import {
  requireUser,
  sameOrigin,
  jsonBody,
  errorResponse,
  HttpError,
} from "@/lib/auth";
import { actorTransaction } from "@/lib/db";
import { operationalWorkspace } from "@/lib/operational-workspace";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    const result = z
      .object({
        store: z.string().min(1),
        currency: z.enum(["USD", "EUR", "GBP"]),
        entity: z.string().optional(),
        key: z.string().min(1).max(200),
        reason: z.string().trim().min(1).max(500),
      })
      .strict()
      .safeParse(await jsonBody(request));
    if (!result.success) throw new HttpError(400, "Invalid alert review");
    const v = result.data,
      op = await operationalWorkspace(
        v.store,
        v.currency,
        v.entity,
        user.role === "OWNER",
      );
    if (!op.alerts.some((a) => a.id === v.key))
      throw new HttpError(404, "Alert is no longer active in this context");
    await actorTransaction(user.id, async (tx) => {
      await tx.query(
        "INSERT INTO alert_acknowledgements(alert_key,acknowledged_by,reason) VALUES($1,$2,$3) ON CONFLICT(alert_key) DO UPDATE SET acknowledged_by=EXCLUDED.acknowledged_by,reason=EXCLUDED.reason,acknowledged_at=now()",
        [v.key, user.id, v.reason],
      );
      await tx.query(
        "INSERT INTO audit_logs(table_name,record_id,action,next_value,actor_id) VALUES('alert_review',$1,'ACKNOWLEDGED',$2::jsonb,$3)",
        [v.key, JSON.stringify({ reason: v.reason }), user.id],
      );
    });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
