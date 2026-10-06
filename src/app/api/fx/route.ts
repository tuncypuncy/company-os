import { requireUser, errorResponse, HttpError } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { integer } from "@/lib/finance";
import { convertMinor } from "@/lib/reporting";
export async function GET(request: Request) {
  try {
    await requireUser();
    const p = new URL(request.url).searchParams,
      currency = p.get("currency") || "USD",
      store = p.get("store") || "all",
      entity = p.get("entity");
    if (!["USD", "EUR", "GBP"].includes(currency))
      throw new HttpError(400, "Unsupported reporting currency");
    const db = await getDb();
    const accounts = (
      await db.query<{
        id: string;
        name: string;
        currency: string;
        available_minor: string;
        observed_at: string;
        entity: string;
        source: string;
      }>(
        "SELECT a.id,a.name,a.currency,b.available_minor,b.observed_at,b.source,e.name AS entity FROM cash_accounts a JOIN legal_entities e ON e.id=a.legal_entity_id JOIN LATERAL(SELECT * FROM cash_balance_snapshots WHERE account_id=a.id ORDER BY observed_at DESC LIMIT 1)b ON true WHERE ($1='all' OR a.store_id=$1) AND ($2::text IS NULL OR a.legal_entity_id=$2)",
        [store, entity],
      )
    ).rows;
    const rows = [];
    for (const a of accounts) {
      const fx =
        a.currency === currency
          ? null
          : (
              await db.query<{
                id: string;
                rate: string;
                source: string;
                observed_at: string;
              }>(
                "SELECT * FROM fx_rates WHERE base_currency=$1 AND quote_currency=$2 AND observed_at<=now() ORDER BY observed_at DESC LIMIT 1",
                [a.currency, currency],
              )
            ).rows[0];
      rows.push({
        ...a,
        originalMinor: integer(a.available_minor),
        convertedMinor:
          a.currency === currency
            ? integer(a.available_minor)
            : fx
              ? convertMinor(integer(a.available_minor), String(fx.rate))
              : null,
        rate: a.currency === currency ? "1" : fx ? String(fx.rate) : null,
        rateSource:
          a.currency === currency
            ? "SAME_CURRENCY"
            : (fx?.source ?? "UNAVAILABLE"),
        rateId: fx?.id ?? null,
        rateObservedAt: fx?.observed_at ?? null,
      });
    }
    return Response.json(
      {
        currency,
        asOf: new Date().toISOString(),
        accounts: rows,
        total:
          rows.length && rows.every((r) => r.convertedMinor !== null)
            ? rows.reduce((n, r) => n + (r.convertedMinor ?? 0), 0)
            : null,
        assumption:
          "Translation uses explicit direct observed rates. Cash is not assumed transferable between entities; missing FX prevents a total.",
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
