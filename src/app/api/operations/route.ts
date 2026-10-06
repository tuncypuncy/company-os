import { z } from "zod";
import {
  requireUser,
  sameOrigin,
  jsonBody,
  errorResponse,
  HttpError,
} from "@/lib/auth";
import { actorTransaction } from "@/lib/db";
import { parseOperation, executeOperation } from "@/lib/operations";
import { operationalWorkspace } from "@/lib/operational-workspace";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    const command = parseOperation(await jsonBody(request), user);
    return Response.json(
      await actorTransaction(user.id, (tx) =>
        executeOperation(tx, command, user.id),
      ),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError)
      return Response.json(
        { error: error.issues[0]?.message || "Invalid operation" },
        { status: 400 },
      );
    return errorResponse(error);
  }
}
export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const p = new URL(request.url).searchParams;
    const store = p.get("store") || "gia",
      currency = p.get("currency") || "USD",
      entity = p.get("entity") || undefined;
    if (
      !/^[a-zA-Z0-9_-]{1,100}$/.test(store) ||
      !["USD", "EUR", "GBP"].includes(currency)
    )
      throw new HttpError(400, "Invalid context");
    return Response.json(
      await operationalWorkspace(
        store,
        currency,
        entity,
        user.role === "OWNER",
      ),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
