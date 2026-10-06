import { z } from "zod";
import { cookies } from "next/headers";
import {
  requireUser,
  sameOrigin,
  jsonBody,
  errorResponse,
  HttpError,
  verifyPassword,
  passwordHash,
  sessionCookie,
} from "@/lib/auth";
import { actorTransaction } from "@/lib/db";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    const result = z
      .object({
        current: z.string().min(1).max(256),
        password: z.string().min(14).max(256),
      })
      .strict()
      .safeParse(await jsonBody(request));
    if (!result.success)
      throw new HttpError(
        400,
        "Use your current password and a new password of 14–256 characters",
      );
    await actorTransaction(user.id, async (tx) => {
      const row = (
        await tx.query<{ password_hash: string | null }>(
          "SELECT password_hash FROM users WHERE id=$1 FOR UPDATE",
          [user.id],
        )
      ).rows[0];
      if (
        !row?.password_hash ||
        !verifyPassword(result.data.current, row.password_hash)
      )
        throw new HttpError(401, "Current password is incorrect");
      await tx.query("UPDATE users SET password_hash=$2 WHERE id=$1", [
        user.id,
        passwordHash(result.data.password),
      ]);
      await tx.query("DELETE FROM sessions WHERE user_id=$1", [user.id]);
      await tx.query(
        "INSERT INTO audit_logs(table_name,record_id,action,next_value,actor_id) VALUES('user_access',$1,'PASSWORD_CHANGED','{}'::jsonb,$2)",
        [user.id, user.id],
      );
    });
    (await cookies()).delete(sessionCookie);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
