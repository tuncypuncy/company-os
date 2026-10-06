import { NextResponse } from "next/server";
import { z } from "zod";
import { appMode, getDb } from "@/lib/db";
import {
  jsonBody,
  currentUser,
  errorResponse,
  HttpError,
  issueSession,
  sameOrigin,
  sessionCookie,
  tokenHash,
  verifyPassword,
} from "@/lib/auth";
import { cookies } from "next/headers";
export const runtime = "nodejs";
export async function GET() {
  try {
    return Response.json({ user: await currentUser(), mode: appMode() });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const raw = await jsonBody(request);
    const checked = z
      .object({
        demo: z.boolean().optional(),
        email: z.string().optional(),
        password: z.string().optional(),
      })
      .safeParse(raw);
    if (!checked.success) throw new HttpError(400, "Invalid login request");
    const body = checked.data;
    let userId: string;
    if (body.demo === true) {
      if (appMode() !== "demo")
        throw new HttpError(403, "Demo login is disabled in live mode");
      await getDb();
      userId = "demo-owner";
    } else {
      const parsed = z
        .object({
          email: z.email().max(254),
          password: z.string().min(1).max(256),
        })
        .safeParse(body);
      if (!parsed.success)
        throw new HttpError(400, "Enter a valid email and password");
      const email = parsed.data.email.toLowerCase().trim();
      const db = await getDb();
      const attempt = await db.query<{
        failures: number;
        blocked_until: string | null;
      }>(
        "SELECT failures,blocked_until FROM auth_attempts WHERE identifier=$1",
        [tokenHash(email)],
      );
      if (
        attempt.rows[0]?.blocked_until &&
        new Date(attempt.rows[0].blocked_until).getTime() > Date.now()
      )
        throw new HttpError(429, "Too many attempts. Try again in 15 minutes.");
      const result = await db.query<{
        id: string;
        password_hash: string | null;
      }>(
        "SELECT id,password_hash FROM users WHERE email=$1 AND active=true AND (is_demo=false OR $2=true)",
        [email, appMode() === "demo"],
      );
      const user = result.rows[0];
      const valid = verifyPassword(
        parsed.data.password,
        user?.password_hash ??
          "00000000000000000000000000000000:" + "00".repeat(64),
      );
      if (!user || !valid) {
        await db.query(
          "INSERT INTO auth_attempts(identifier,failures,blocked_until) VALUES($1,1,NULL) ON CONFLICT(identifier) DO UPDATE SET failures=CASE WHEN auth_attempts.updated_at<now()-interval '15 minutes' THEN 1 ELSE auth_attempts.failures+1 END,blocked_until=CASE WHEN auth_attempts.failures>=4 AND auth_attempts.updated_at>=now()-interval '15 minutes' THEN now()+interval '15 minutes' ELSE NULL END,updated_at=now()",
          [tokenHash(email)],
        );
        throw new HttpError(401, "Email or password is incorrect");
      }
      await db.query("DELETE FROM auth_attempts WHERE identifier=$1", [
        tokenHash(email),
      ]);
      userId = user.id;
    }
    const token = await issueSession(userId);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(sessionCookie, token, {
      httpOnly: true,
      secure:
        process.env.APP_ORIGIN?.startsWith("https://") ??
        new URL(request.url).protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: 8 * 3600,
    });
    return response;
  } catch (e) {
    return errorResponse(e);
  }
}
export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    const token = (await cookies()).get(sessionCookie)?.value;
    if (token)
      await (
        await getDb()
      ).query("DELETE FROM sessions WHERE token_hash=$1", [tokenHash(token)]);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(sessionCookie, "", {
      httpOnly: true,
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (e) {
    return errorResponse(e);
  }
}
