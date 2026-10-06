import {
  randomBytes,
  createHash,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";
import { getDb, appMode } from "./db";
export type User = {
  id: string;
  email: string;
  name: string;
  role: "OWNER" | "OPERATIONS_MANAGER";
  is_demo: boolean;
};
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const sessionCookie = "company_os_session";
export const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function verifyPassword(password: string, hash: string) {
  try {
    const [salt, digest] = hash.split(":");
    const expected = Buffer.from(digest, "hex");
    const actual = scryptSync(password, salt, 64);
    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  } catch {
    return false;
  }
}
export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token) return null;
  const { rows } = await (
    await getDb()
  ).query<User>(
    "SELECT u.id,u.email,u.name,u.role,u.is_demo FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true",
    [tokenHash(token)],
  );
  return rows[0] ?? null;
}
export async function requireUser(options: { owner?: boolean } = {}) {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Sign in to continue");
  if (options.owner && user.role !== "OWNER")
    throw new HttpError(403, "Only the owner can change these records");
  if (appMode() === "live" && user.is_demo)
    throw new HttpError(403, "Demo sessions cannot access live data");
  return user;
}
export async function issueSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  await (
    await getDb()
  ).query(
    "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)",
    [
      tokenHash(token),
      userId,
      new Date(Date.now() + 8 * 3600000).toISOString(),
    ],
  );
  return token;
}
export function sameOrigin(request: Request) {
  if (appMode() === "live" && !process.env.APP_ORIGIN)
    throw new HttpError(
      503,
      "Set APP_ORIGIN to the exact public HTTPS origin before enabling live writes",
    );
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  const protocol =
    request.headers.get("x-forwarded-proto") || url.protocol.slice(0, -1);
  const expected =
    process.env.APP_ORIGIN ||
    `${protocol}://${request.headers.get("host") || url.host}`;
  if (!origin || origin !== expected)
    throw new HttpError(403, "Cross-origin requests are not allowed");
}
export function errorResponse(error: unknown) {
  if (error instanceof HttpError)
    return Response.json({ error: error.message }, { status: error.status });
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "23505"
  )
    return Response.json(
      {
        error:
          "A record with this identity already exists. Nothing was posted twice.",
      },
      { status: 409 },
    );
  console.error(
    "Company OS request failed:",
    error instanceof Error ? error.message : "unknown error",
  );
  return Response.json(
    {
      error:
        "The request could not be completed. Check the server configuration or try again.",
    },
    { status: 500 },
  );
}

export async function limitedBody(
  request: Request,
  maxBytes = 65536,
): Promise<Buffer> {
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Buffer[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maxBytes) {
      await reader.cancel();
      throw new HttpError(413, "Request body is too large");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}
export async function jsonBody(request: Request): Promise<unknown> {
  try {
    return JSON.parse((await limitedBody(request)).toString("utf8"));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "Invalid JSON request");
  }
}
