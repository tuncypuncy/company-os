import { requireUser, errorResponse, HttpError } from "@/lib/auth";
import { reportingWorkspace } from "@/lib/reporting";
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
    const brand = p.get("brand") || undefined,
      from = p.get("from"),
      to = p.get("to");
    const validDate = (s: string) =>
      /^\d{4}-\d{2}-\d{2}$/.test(s) &&
      Number.isFinite(Date.parse(s)) &&
      new Date(s).toISOString().slice(0, 10) === s;
    if (
      (from || to) &&
      (!from ||
        !to ||
        !validDate(from) ||
        !validDate(to) ||
        from > to ||
        Date.parse(to) - Date.parse(from) > 365 * 86400000)
    )
      throw new HttpError(400, "Use a valid date range of at most one year");
    if (brand && !/^[a-zA-Z0-9_-]{1,80}$/.test(brand))
      throw new HttpError(400, "Invalid brand");
    if (
      !/^[a-zA-Z0-9_-]{1,80}$/.test(store) ||
      !["USD", "EUR", "GBP"].includes(currency) ||
      ![1, 7, 30].includes(days) ||
      (entity && !/^[a-zA-Z0-9_-]{1,80}$/.test(entity))
    )
      throw new HttpError(400, "Invalid dashboard filter");
    return Response.json(
      await reportingWorkspace(
        store,
        currency,
        days,
        entity,
        user.role === "OWNER",
        brand,
        from && to ? { from, to } : undefined,
      ),
      {
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
