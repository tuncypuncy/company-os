import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  requireUser,
  sameOrigin,
  jsonBody,
  errorResponse,
  HttpError,
  passwordHash,
} from "@/lib/auth";
import { actorTransaction, getDb, appMode } from "@/lib/db";
export async function GET() {
  try {
    await requireUser({ owner: true });
    const r = await (
      await getDb()
    ).query(
      "SELECT id,email,name,role,active,is_demo,created_at FROM users ORDER BY created_at",
    );
    return Response.json(
      { users: r.rows },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const actor = await requireUser({ owner: true });
    const schema = z
      .object({
        email: z.email().transform((v) => v.toLowerCase()),
        name: z.string().trim().min(1).max(120),
        password: z.string().min(14).max(256),
        role: z.enum(["OWNER", "OPERATIONS_MANAGER"]),
      })
      .strict();
    const result = schema.safeParse(await jsonBody(request));
    if (!result.success)
      throw new HttpError(400, result.error.issues[0].message);
    const v = result.data,
      id = randomUUID();
    await actorTransaction(actor.id, async (tx) => {
      await tx.query(
        "INSERT INTO users(id,email,name,password_hash,role,is_demo) VALUES($1,$2,$3,$4,$5,$6)",
        [
          id,
          v.email,
          v.name,
          passwordHash(v.password),
          v.role,
          appMode() === "demo",
        ],
      );
      await tx.query(
        "INSERT INTO audit_logs(table_name,record_id,action,next_value,actor_id) VALUES('user_access',$1,'INSERT',$2::jsonb,$3)",
        [
          id,
          JSON.stringify({ email: v.email, role: v.role, name: v.name }),
          actor.id,
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
    const actor = await requireUser({ owner: true });
    const result = z
      .object({ id: z.string().min(1), active: z.boolean() })
      .strict()
      .safeParse(await jsonBody(request));
    if (!result.success) throw new HttpError(400, "Invalid access change");
    if (result.data.id === actor.id)
      throw new HttpError(400, "You cannot disable your own active session");
    await actorTransaction(actor.id, async (tx) => {
      const record = (
        await tx.query<{ role: string; is_demo: boolean }>(
          "SELECT role,is_demo FROM users WHERE id=$1 FOR UPDATE",
          [result.data.id],
        )
      ).rows[0];
      if (!record) throw new HttpError(404, "User not found");
      if (record.is_demo && appMode() === "live")
        throw new HttpError(403, "Demo access is unavailable in live mode");
      await tx.query("UPDATE users SET active=$2 WHERE id=$1", [
        result.data.id,
        result.data.active,
      ]);
      await tx.query("DELETE FROM sessions WHERE user_id=$1", [result.data.id]);
      await tx.query(
        "INSERT INTO audit_logs(table_name,record_id,action,next_value,actor_id) VALUES('user_access',$1,'UPDATE',$2::jsonb,$3)",
        [
          result.data.id,
          JSON.stringify({ active: result.data.active }),
          actor.id,
        ],
      );
    });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
