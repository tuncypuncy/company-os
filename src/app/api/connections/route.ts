import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  requireUser,
  sameOrigin,
  jsonBody,
  errorResponse,
  HttpError,
} from "@/lib/auth";
import { actorTransaction, getDb } from "@/lib/db";
import {
  connectionSchema,
  parseConfig,
  connectionList,
  syncConnection,
} from "@/lib/integrations/service";
import { IntegrationError } from "@/lib/integrations/http";
function failure(e: unknown) {
  if (e instanceof z.ZodError)
    return Response.json({ error: e.issues[0].message }, { status: 400 });
  if (e instanceof IntegrationError)
    return Response.json(
      { error: e.message, code: e.code },
      { status: e.code === "NOT_CONNECTED" ? 503 : 422 },
    );
  return errorResponse(e);
}
export async function GET(request: Request) {
  try {
    await requireUser();
    const store = new URL(request.url).searchParams.get("store") || "gia";
    return Response.json(
      { connections: await connectionList(store) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser({ owner: true });
    const v = connectionSchema.parse(await jsonBody(request)),
      config = parseConfig(v.platform, v.config),
      id = randomUUID();
    await actorTransaction(user.id, async (tx) => {
      if (
        !(await tx.query("SELECT id FROM stores WHERE id=$1", [v.storeId])).rows
          .length
      )
        throw new HttpError(400, "Unknown store");
      if (
        !(
          await tx.query("SELECT id FROM legal_entities WHERE id=$1", [
            config.entityId,
          ])
        ).rows.length
      )
        throw new HttpError(400, "Unknown company");
      await tx.query(
        "INSERT INTO integration_connections(id,platform,store_id,status,config,capabilities) VALUES($1,$2,$3,'NOT_CONNECTED',$4::jsonb,$5::jsonb)",
        [
          id,
          v.platform,
          v.storeId,
          JSON.stringify(config),
          JSON.stringify(
            v.platform === "Shopify"
              ? { catalog: true, orders: true, refunds: true, payouts: false }
              : v.platform === "Meta"
                ? { spend: true, adsetBudgets: true, creditFacility: false }
                : {
                    inventory: !!(
                      "verifiedProfile" in config && config.verifiedProfile
                    ),
                    shipments: false,
                  },
          ),
        ],
      );
    });
    return Response.json({ id, status: "NOT_CONNECTED" }, { status: 201 });
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser({ owner: true });
    const v = z
      .object({
        id: z.string().min(1),
        action: z.enum(["check", "sync", "disconnect"]),
        since: z.iso.datetime().optional(),
      })
      .strict()
      .parse(await jsonBody(request));
    if (v.action === "disconnect") {
      await (
        await getDb()
      ).query(
        "UPDATE integration_connections SET status='DISCONNECTED' WHERE id=$1",
        [v.id],
      );
      return Response.json({ status: "DISCONNECTED" });
    }
    return Response.json(
      await syncConnection(v.id, user.id, v.action, v.since),
    );
  } catch (e) {
    return failure(e);
  }
}
