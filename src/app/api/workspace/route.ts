import { requireUser, errorResponse, HttpError } from "@/lib/auth";
import { workspace } from "@/lib/workspace";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const p = new URL(request.url).searchParams;
    const store = p.get("store") || "gia",
      currency = p.get("currency") || "USD",
      days = Number(p.get("days") || 7),
      entity = p.get("entity") || undefined;
    if (
      !/^[a-zA-Z0-9_-]{1,80}$/.test(store) ||
      !["USD", "EUR", "GBP"].includes(currency) ||
      ![1, 7, 30].includes(days) ||
      (entity && !/^[a-zA-Z0-9_-]{1,80}$/.test(entity))
    )
      throw new HttpError(400, "Invalid dashboard filter");
    return Response.json(
      await workspace(store, currency, days, entity, user.role === "OWNER"),
      {
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
