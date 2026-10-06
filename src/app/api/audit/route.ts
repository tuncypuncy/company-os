import { requireUser, errorResponse, HttpError } from "@/lib/auth";
import { getDb } from "@/lib/db";
const tables = [
  "user_access",
  "invoices",
  "cost_rules",
  "obligations",
  "cash_balance_snapshots",
  "expenses",
  "recurring_expenses",
  "prepaid_cost_pools",
  "prepaid_consumption",
  "order_costs",
  "cost_reconciliations",
  "refunds",
  "expected_inflows",
  "meta_credit_snapshots",
  "meta_payments",
  "payroll_runs",
  "owner_records",
  "mapping_history",
  "inventory_snapshots",
  "inbound_shipments",
  "workspace_settings",
  "sku_mappings",
  "ad_spend",
];
export async function GET(request: Request) {
  try {
    await requireUser({ owner: true });
    const p = new URL(request.url).searchParams,
      table = p.get("table"),
      record = p.get("record");
    if (table && !tables.includes(table))
      throw new HttpError(400, "Invalid audit table");
    const db = await getDb();
    const rows = await db.query(
      "SELECT * FROM audit_logs WHERE ($1::text IS NULL OR table_name=$1) AND ($2::text IS NULL OR record_id=$2) ORDER BY created_at DESC,id DESC LIMIT 200",
      [table, record],
    );
    return Response.json(
      { tables, records: rows.rows },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
