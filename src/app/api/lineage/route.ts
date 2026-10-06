import { requireUser, errorResponse, HttpError } from "@/lib/auth";
import { getDb } from "@/lib/db";
const families: Record<string, string> = {
  expenses: "expenses",
  recurring: "recurring_expenses",
  inflows: "expected_inflows",
  pools: "prepaid_cost_pools",
  orders: "orders",
  costs: "order_costs",
  refunds: "refunds",
  payroll: "payroll_runs",
  shipments: "inbound_shipments",
  metaPayments: "meta_payments",
  invoices: "invoices",
  inventory: "inventory_snapshots",
  variants: "variants",
  products: "products",
  supplierSkus: "supplier_skus",
  warehouses: "warehouses",
};
export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const p = new URL(request.url).searchParams,
      kind = p.get("kind") || "",
      id = p.get("id");
    const table = families[kind];
    if (!table || !id)
      throw new HttpError(400, "Unknown lineage record family");
    if (
      ["payroll", "refunds", "metaPayments"].includes(kind) &&
      user.role !== "OWNER"
    )
      throw new HttpError(403, "Owner permission required");
    const db = await getDb(),
      record = (
        await db.query<Record<string, unknown>>(
          `SELECT * FROM ${table} WHERE id=$1`,
          [id],
        )
      ).rows[0];
    if (!record) throw new HttpError(404, "Source record not found");
    if (
      user.role !== "OWNER" &&
      (/payroll|salary|tax|vat|dividend|distribution|owner|contribution/i.test(
        String(record.category || ""),
      ) ||
        record.recognition === "PERSONAL")
    )
      throw new HttpError(403, "Owner permission required");
    const related: Record<string, unknown[]> = {};
    if (kind === "expenses")
      related.attachments = (
        await db.query(
          "SELECT id,original_name,mime_type,size_bytes,sha256,created_at FROM expense_attachments WHERE expense_id=$1 ORDER BY created_at",
          [id],
        )
      ).rows;
    if (kind === "costs") {
      related.orderItems = (
        await db.query("SELECT * FROM order_items WHERE id=$1", [
          record.order_item_id,
        ])
      ).rows;
      related.rule = (
        await db.query("SELECT * FROM cost_rules WHERE id=$1", [
          record.cost_rule_id,
        ])
      ).rows;
      related.revisions = (
        await db.query(
          "SELECT r.*,i.invoice_id FROM cost_reconciliations r JOIN invoice_items i ON i.id=r.invoice_item_id WHERE order_cost_id=$1 ORDER BY revision",
          [id],
        )
      ).rows;
      related.prepaid = (
        await db.query(
          "SELECT c.*,p.name,p.component FROM prepaid_consumption c JOIN prepaid_cost_pools p ON p.id=c.pool_id WHERE c.order_item_id=$1",
          [record.order_item_id],
        )
      ).rows;
    }
    if (kind === "invoices") {
      related.lines = (
        await db.query("SELECT * FROM invoice_items WHERE invoice_id=$1", [id])
      ).rows;
      related.payment = (
        await db.query(
          "SELECT id,status,due_at,paid_at,amount_minor,source FROM obligations WHERE invoice_id=$1",
          [id],
        )
      ).rows;
      related.attachments = (
        await db.query(
          "SELECT id,original_name,mime_type,size_bytes,sha256 FROM invoice_attachments WHERE invoice_id=$1",
          [id],
        )
      ).rows;
    }
    if (kind === "orders") {
      related.items = (
        await db.query("SELECT * FROM order_items WHERE order_id=$1", [id])
      ).rows;
      related.costs = (
        await db.query(
          "SELECT c.* FROM order_costs c JOIN order_items i ON i.id=c.order_item_id WHERE i.order_id=$1",
          [id],
        )
      ).rows;
      if (user.role === "OWNER")
        related.refunds = (
          await db.query("SELECT * FROM refunds WHERE order_id=$1", [id])
        ).rows;
    }
    if (kind === "shipments") {
      related.events = (
        await db.query(
          "SELECT * FROM shipment_events WHERE shipment_id=$1 ORDER BY occurred_at",
          [id],
        )
      ).rows;
      related.items = (
        await db.query("SELECT * FROM shipment_items WHERE shipment_id=$1", [
          id,
        ])
      ).rows;
    }
    if (record.obligation_id)
      related.payments = (
        await db.query(
          "SELECT id,amount_minor,paid_at,source,reference FROM obligation_payments WHERE obligation_id=$1 ORDER BY paid_at",
          [record.obligation_id],
        )
      ).rows;
    if (kind === "pools")
      related.consumption = (
        await db.query("SELECT * FROM prepaid_consumption WHERE pool_id=$1", [
          id,
        ])
      ).rows;
    const audit =
      user.role === "OWNER"
        ? (
            await db.query(
              "SELECT * FROM audit_logs WHERE table_name=$1 AND record_id=$2 ORDER BY id DESC LIMIT 50",
              [table, id],
            )
          ).rows
        : [];
    return Response.json(
      {
        kind,
        record,
        related,
        audit,
        methodology:
          "Source values, matched rule version, preserved estimates and reviewed revisions are independent records. No customer country attribution is inferred.",
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
