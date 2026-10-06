import { z } from "zod";
import { minor } from "./finance";
const amount = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/)
  .transform(minor);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "Invalid calendar date");
export const invoiceSchema = z
  .object({
    vendor: z.string().trim().min(1).max(120),
    invoiceNumber: z.string().trim().min(1).max(100),
    entityId: z.string().min(1),
    storeId: z.string().min(1),
    currency: z.enum(["USD", "EUR", "GBP"]),
    invoiceDate: date,
    effectiveDate: date,
    dueDate: date,
    total: amount.refine((n) => n > 0),
    notes: z.string().max(2000).default(""),
    confirmed: z.literal(true),
    createRules: z.boolean().default(false),
    items: z
      .array(
        z.object({
          productId: z.string().min(1),
          bundles: z.number().int().positive().max(1000000),
          bundleQuantity: z.number().int().positive().max(1000),
          product: amount,
          packaging: amount,
          fulfillment: amount,
          shipping: amount,
          other: amount,
        }),
      )
      .min(1)
      .max(50),
  })
  .superRefine((v, ctx) => {
    const sum = v.items.reduce(
      (a, i) =>
        a +
        i.bundles *
          (i.product + i.packaging + i.fulfillment + i.shipping + i.other),
      0,
    );
    if (!Number.isSafeInteger(sum) || sum !== v.total)
      ctx.addIssue({
        code: "custom",
        message: "Line totals must equal the invoice total",
        path: ["total"],
      });
    if (
      v.createRules &&
      new Set(v.items.map((i) => `${i.productId}:${i.bundleQuantity}`)).size !==
        v.items.length
    )
      ctx.addIssue({
        code: "custom",
        message:
          "One price per product and bundle size is allowed when creating rules",
      });
  });
export const categories = [
  "Supplier",
  "Inventory",
  "Advertising",
  "Freight",
  "Fulfillment",
  "Shipping",
  "Freelancer",
  "Agency",
  "SaaS",
  "Shopify Apps",
  "Payroll",
  "Employer Contributions",
  "VAT",
  "Sales Tax",
  "Corporate Tax",
  "Payroll Tax",
  "Owner Tax",
  "Owner Salary",
  "Owner Draw",
  "Distribution",
  "Dividend",
  "Accounting",
  "Office",
  "Amazon",
  "Other",
] as const;
export const obligationSchema = z.object({
  title: z.string().trim().min(1).max(150),
  entityId: z.string().min(1),
  storeId: z.string().min(1),
  currency: z.enum(["USD", "EUR", "GBP"]),
  amount: amount.refine((n) => n > 0),
  dueDate: date,
  category: z.enum(categories),
  scope: z.enum(["COMPANY", "PERSONAL"]),
  filingDate: date.optional().or(z.literal("")),
  period: z.string().max(100).optional(),
  jurisdiction: z.string().max(100).optional(),
});
export function attachmentType(buffer: Buffer) {
  if (buffer.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  if (
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255)
    return "image/jpeg";
  return null;
}
