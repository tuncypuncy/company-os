export type Field = {
  name: string;
  label: string;
  type?: "text" | "date" | "number" | "datetime-local" | "textarea";
  options?: string[];
  lookup?: string;
  optional?: boolean;
  value?: string;
};
const money = (name: string, label: string): Field => ({
  name,
  label,
  type: "text",
  value: "0.00",
});
const number = (name: string, label: string, value = "1"): Field => ({
  name,
  label,
  type: "number",
  value,
});
const date = (name: string, label: string): Field => ({
  name,
  label,
  type: "date",
});
const ref = (name: string, label: string, lookup: string): Field => ({
  name,
  label,
  lookup,
});
const text = (name: string, label: string, optional = false): Field => ({
  name,
  label,
  optional,
});
export const operations: Record<
  string,
  {
    label: string;
    section: string;
    owner?: boolean;
    description: string;
    fields: Field[];
  }
> = {
  order: {
    label: "Record manual order",
    section: "commerce",
    description:
      "Manual source order; gross excludes tax, with discounts and processing fees entered separately. Quantity is physical units.",
    fields: [
      text("externalId", "Unique order reference"),
      ref("productId", "Product", "products"),
      text("sku", "Commercial SKU"),
      number("quantity", "Physical units"),
      number("bundleQuantity", "Priced bundle size"),
      money("gross", "Gross sales excluding tax"),
      money("discount", "Discounts"),
      money("fees", "Processing fees"),
      date("date", "Order date"),
    ],
  },
  "cost-rule": {
    label: "Version a COGS rule",
    section: "commerce",
    owner: true,
    description:
      "A new interval closes the prior matching rule. Preserved order snapshots retain their original version.",
    fields: [
      ref("productId", "Product", "products"),
      number("bundleQuantity", "Priced bundle size"),
      money("product", "Product cost"),
      money("packaging", "Packaging cost"),
      money("fulfillment", "Fulfillment cost"),
      money("shipping", "Shipping cost"),
      money("other", "Other cost"),
      date("effectiveStart", "Effective from"),
      text("sku", "SKU constraint", true),
      text("country", "Country constraint", true),
      text("batch", "Batch constraint", true),
      text("reason", "Source / change reason"),
    ],
  },
  expense: {
    label: "Record expense",
    section: "expenses",
    description:
      "Recognition and payment are separate. Capital purchases and COGS-linked costs do not become operating expense again.",
    fields: [
      text("vendor", "Vendor"),
      text("category", "Category"),
      money("amount", "Amount"),
      date("recognizedDate", "Recognition date"),
      date("dueDate", "Payment due"),
      {
        name: "recognition",
        label: "Recognition",
        options: ["OPERATING", "CAPITAL", "COGS_LINKED", "PERSONAL"],
      },
      text("notes", "Evidence / notes", true),
    ],
  },
  recurring: {
    label: "Add subscription",
    section: "expenses",
    description:
      "Create a versioned recurring cost. Generate reviewed payment instances separately.",
    fields: [
      text("vendor", "App / vendor"),
      text("category", "Category"),
      money("amount", "Current price"),
      {
        name: "frequency",
        label: "Frequency",
        options: ["MONTHLY", "WEEKLY", "QUARTERLY", "YEARLY", "DAILY"],
      },
      date("nextDue", "Next charge"),
    ],
  },
  "recurring-update": {
    label: "Update subscription",
    section: "expenses",
    description:
      "Retains old prices. Existing scheduled charges retain their original amounts.",
    fields: [
      ref("id", "Subscription", "recurring"),
      money("amount", "New price"),
      { name: "active", label: "Status", options: ["ACTIVE", "CANCELLED"] },
      text("reason", "Change reason"),
    ],
  },
  "recurring-generate": {
    label: "Schedule recurring charges",
    section: "expenses",
    description:
      "Generate each unpaid occurrence once through the selected date; cancelled subscriptions are skipped.",
    fields: [date("through", "Generate through")],
  },
  inflow: {
    label: "Add expected inflow",
    section: "cash",
    owner: true,
    description:
      "Estimated revenue is not available cash. Enter a settlement amount and arrival time.",
    fields: [
      text("title", "Settlement / source"),
      money("amount", "Expected amount"),
      { name: "expectedAt", label: "Expected arrival", type: "datetime-local" },
      {
        name: "status",
        label: "Confidence",
        options: ["ESTIMATED", "CONFIRMED"],
      },
    ],
  },
  "inflow-settle": {
    label: "Settle an inflow",
    section: "cash",
    owner: true,
    description:
      "Marks the forecast event received. Refresh the bank snapshot separately.",
    fields: [ref("id", "Expected inflow", "inflows")],
  },
  settings: {
    label: "Configure risk policy",
    section: "settings",
    owner: true,
    description:
      "Manual policy settings govern cash, stock, credit and freshness alerts; they are not tax elections.",
    fields: [
      money("buffer", "Cash safety buffer"),
      number("watch", "Inventory watch days", "14"),
      number("critical", "Inventory critical days", "3"),
      number("metaWatch", "Meta watch days", "3"),
      number("freshness", "Freshness limit (hours)", "24"),
      {
        name: "refundPolicy",
        label: "Refund methodology",
        options: ["PLATFORM", "INTERNAL_REVIEWED"],
      },
    ],
  },
  refund: {
    label: "Review a refund",
    section: "commerce",
    owner: true,
    description:
      "Preserves platform values. COGS recovery and fee impact require explicit evidence; restock does not automatically change a stock snapshot.",
    fields: [
      ref("orderId", "Order", "orders"),
      text("eventId", "Unique refund reference"),
      money("platform", "Platform amount"),
      money("internal", "Reviewed internal amount"),
      money("recovered", "Recovered COGS"),
      money("feeImpact", "Additional fee cost"),
      date("date", "Refund date"),
      {
        name: "restocked",
        label: "Restock evidence",
        options: ["UNKNOWN", "YES", "NO"],
      },
      text("reason", "Review reason"),
    ],
  },
  "cost-calculate": {
    label: "Snapshot order estimates",
    section: "commerce",
    description:
      "Stores the matched rule and components. Existing snapshots are preserved; missing mappings are reported.",
    fields: [],
  },
  reconcile: {
    label: "Reconcile invoice cost",
    section: "commerce",
    owner: true,
    description:
      "Allocate one invoice line to one preserved order estimate. Control totals reject over-allocation and keep revision history.",
    fields: [
      ref("costId", "Order cost snapshot", "costs"),
      ref("invoiceItemId", "Invoice line", "invoiceItems"),
      money("actual", "Actual allocated cost"),
      text("reason", "Allocation / revision reason"),
    ],
  },
  pool: {
    label: "Create prepaid pool",
    section: "prepaid",
    owner: true,
    description:
      "An upfront payment creates one liability. Consumption replaces the selected COGS component rather than adding it twice.",
    fields: [
      text("name", "Pool name"),
      ref("productId", "Eligible product", "products"),
      number("quantity", "Purchased usable units"),
      money("amount", "Total prepaid cost"),
      {
        name: "component",
        label: "Cost component",
        options: ["packaging", "product", "fulfillment", "shipping", "other"],
      },
      date("purchaseDate", "Purchase date"),
      date("dueDate", "Payment due"),
    ],
  },
  consume: {
    label: "Allocate prepaid consumption",
    section: "prepaid",
    owner: true,
    description:
      "Allocation is idempotent per pool/order line and cannot consume more units than the pool or order line.",
    fields: [
      ref("poolId", "Pool", "pools"),
      ref("itemId", "Order item", "orderItems"),
      number("quantity", "Units consumed"),
    ],
  },
  payroll: {
    label: "Record payroll run",
    section: "payroll",
    owner: true,
    description:
      "Creates separate net-pay and remittance liabilities. Employer expense is gross salary plus employer contributions, not deductions twice.",
    fields: [
      text("employee", "Employee / payroll reference"),
      text("period", "Payroll period"),
      money("gross", "Gross salary"),
      money("deductions", "Employee deductions"),
      money("employer", "Employer contributions"),
      date("payday", "Net salary payday"),
      date("remittance", "Tax / contributions remittance"),
    ],
  },
  owner: {
    label: "Schedule owner payment",
    section: "payroll",
    owner: true,
    description:
      "Choose the actual classification; LLC distributions are not automatically dividends. This does not determine statutory treatment.",
    fields: [
      text("recipient", "Recipient"),
      {
        name: "classification",
        label: "Classification",
        options: [
          "Owner Salary",
          "Owner Draw",
          "Distribution",
          "Dividend",
          "Owner Tax",
        ],
      },
      money("amount", "Payment amount"),
      money("withholding", "Declared withholding (included in amount)"),
      date("dueDate", "Payment due"),
      date("declaredAt", "Declaration / approval date"),
      {
        name: "scope",
        label: "Funding scope",
        options: ["COMPANY", "PERSONAL"],
      },
      text("notes", "Evidence / notes"),
    ],
  },
  product: {
    label: "Add product",
    section: "catalog",
    description:
      "Extend the catalog for the selected brand without code changes.",
    fields: [
      text("name", "Canonical product name"),
      text("alias", "Alias", true),
    ],
  },
  variant: {
    label: "Add store SKU",
    section: "catalog",
    description:
      "A commercial SKU is distinct from supplier SKU. Bundle size is physical units per commercial item.",
    fields: [
      ref("productId", "Product", "products"),
      text("sku", "Commercial SKU"),
      number("bundleSize", "Physical units per item"),
    ],
  },
  supplier: {
    label: "Add supplier",
    section: "inventory",
    description: "Create a supplier identity for reviewed mappings.",
    fields: [text("name", "Supplier name")],
  },
  "supplier-sku": {
    label: "Add supplier SKU",
    section: "inventory",
    description: "No automatic matching to commercial SKU.",
    fields: [
      ref("supplierId", "Supplier", "suppliers"),
      ref("productId", "Product", "products"),
      text("sku", "Supplier SKU"),
    ],
  },
  warehouse: {
    label: "Add warehouse",
    section: "inventory",
    description:
      "US visibility follows the explicit country code, not the store label.",
    fields: [
      text("name", "Warehouse name"),
      text("country", "Country code (US, CN, etc.)"),
      ref("supplierId", "Operator / supplier", "suppliers"),
    ],
  },
  mapping: {
    label: "Map supplier SKU",
    section: "inventory",
    description:
      "Commercial and supplier SKU must refer to the same canonical product.",
    fields: [
      ref("variantId", "Commercial SKU", "variants"),
      ref("supplierSkuId", "Supplier SKU", "supplierSkus"),
    ],
  },
  bom: {
    label: "Add BOM component",
    section: "inventory",
    description:
      "Components consume physical units per sold bundle; recursive bundles are checked for cycles.",
    fields: [
      ref("bundleId", "Bundle SKU", "variants"),
      ref("componentId", "Component SKU", "variants"),
      number("quantity", "Component units per bundle"),
    ],
  },
  stock: {
    label: "Record stock snapshot",
    section: "inventory",
    description:
      "Available is already sellable stock; reserved units are shown separately and are not deducted twice.",
    fields: [
      ref("supplierSkuId", "Supplier SKU", "supplierSkus"),
      ref("warehouseId", "Warehouse", "warehouses"),
      number("available", "Available sellable units", "0"),
      { ...number("reserved", "Reserved units", "0"), optional: true },
      { ...number("onHand", "On-hand units", "0"), optional: true },
      { name: "observedAt", label: "Observed at", type: "datetime-local" },
    ],
  },
  shipment: {
    label: "Plan inbound shipment",
    section: "inventory",
    description:
      "Inbound never becomes current available stock until explicitly received.",
    fields: [
      ref("supplierSkuId", "Supplier SKU", "supplierSkus"),
      ref("warehouseId", "Destination warehouse", "warehouses"),
      number("quantity", "Inbound units"),
      { name: "eta", label: "Expected availability", type: "datetime-local" },
      {
        name: "status",
        label: "Current stage",
        options: ["PRODUCTION", "READY", "SHIPPED", "IN_TRANSIT", "CUSTOMS"],
      },
      text("carrier", "Carrier", true),
      text("tracking", "Tracking", true),
      money("cost", "Supplier / freight liability (0 if already linked)"),
      date("dueDate", "Payment due"),
    ],
  },
  "shipment-stage": {
    label: "Update shipment stage",
    section: "inventory",
    description:
      "AVAILABLE receives stock once. Stage history is retained; recording arrival does not settle its payment.",
    fields: [
      ref("id", "Shipment", "shipments"),
      {
        name: "status",
        label: "Stage",
        options: [
          "PRODUCTION",
          "READY",
          "SHIPPED",
          "IN_TRANSIT",
          "CUSTOMS",
          "WAREHOUSE",
          "AVAILABLE",
          "CANCELLED",
        ],
      },
    ],
  },
  "meta-credit": {
    label: "Record Meta facility",
    section: "meta",
    owner: true,
    description:
      "Manual confirmed credit snapshot. Payments do not restore credit without a new confirmed snapshot.",
    fields: [
      text("name", "Facility name"),
      money("limit", "Credit limit"),
      money("debt", "Outstanding balance"),
      money("daily", "Current daily Meta budget"),
      { name: "observedAt", label: "Observed at", type: "datetime-local" },
      number("clearingDays", "Expected clearing delay (days)", "2"),
    ],
  },
  "meta-payment": {
    label: "Plan Meta payment",
    section: "meta",
    owner: true,
    description:
      "Creates one cash liability linked to the Meta payment. Never adds accrued ad spend as another cash payment.",
    fields: [
      ref("billingId", "Billing facility", "billing"),
      money("amount", "Payment amount"),
      {
        name: "clearingAt",
        label: "Expected credit clearing",
        type: "datetime-local",
      },
      date("dueDate", "Payment date"),
    ],
  },
  "meta-stage": {
    label: "Record payment progress",
    section: "meta",
    owner: true,
    description:
      "Lifecycle stages are evidence only. CREDIT_RESTORED still requires a refreshed source balance.",
    fields: [
      ref("id", "Meta payment", "metaPayments"),
      {
        name: "stage",
        label: "Confirmed stage",
        options: ["INITIATED", "SENT", "RECEIVED", "CREDIT_RESTORED"],
      },
    ],
  },
  "ad-spend": {
    label: "Record ad spend",
    section: "meta",
    owner: true,
    description:
      "Accrued economic spend, not an extra cash outflow. Source/date/account is unique.",
    fields: [
      { name: "platform", label: "Platform", options: ["META", "GOOGLE"] },
      date("date", "Spend date"),
      money("amount", "Actual spend"),
    ],
  },
  "entity-map": {
    label: "Confirm store ownership",
    section: "settings",
    owner: true,
    description:
      "Keeps effective-dated evidence. Existing historical orders are never silently reattributed.",
    fields: [
      date("effectiveStart", "Effective from"),
      text("evidence", "Mapping evidence"),
    ],
  },
  "fx-rate": {
    label: "Record FX rate",
    section: "settings",
    owner: true,
    description:
      "Preserves the original transaction currency; conversions use this explicit observed rate.",
    fields: [
      { name: "base", label: "Base currency", options: ["USD", "EUR", "GBP"] },
      {
        name: "quote",
        label: "Quote currency",
        options: ["EUR", "USD", "GBP"],
      },
      text("rate", "Quote per base"),
      text("evidence", "Rate source"),
      { name: "observedAt", label: "Observed at", type: "datetime-local" },
    ],
  },
};
