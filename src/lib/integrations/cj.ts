import { z } from "zod";
import { apiJson, IntegrationError, type Transport } from "./http";
/** Explicit provider profile is required because official CJ docs cannot currently be reached from this environment. No endpoints or response semantics are guessed. */
export const cjConfig = z
  .object({
    tokenEnv: z.string().regex(/^CJ_[A-Z0-9_]+$/),
    entityId: z.string().min(1),
    supplierId: z.string().min(1),
    verifiedProfile: z
      .object({
        documentationUrl: z
          .string()
          .url()
          .refine(
            (v) => new URL(v).hostname === "developers.cjdropshipping.com",
          ),
        inventoryPath: z.string().regex(/^\/api2\.0\/v1\/[a-zA-Z0-9/_-]+$/),
        skuParameter: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
        rowsPath: z.string().regex(/^[a-zA-Z0-9_.]+$/),
        availableField: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
        warehouseField: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
        confirmed: z.literal(true),
      })
      .optional(),
  })
  .strict();
export type CJConfig = z.infer<typeof cjConfig>;
export class CJAdapter {
  constructor(
    readonly config: CJConfig,
    private token: string,
    private transport: Transport = fetch,
  ) {}
  async inventory(externalSku: string) {
    const p = this.config.verifiedProfile;
    if (!p)
      throw new IntegrationError(
        "DOCUMENTATION_REQUIRED",
        "Confirm CJ endpoint and response semantics from current official documentation before API ingestion",
      );
    const url = new URL(
      "https://developers.cjdropshipping.com" + p.inventoryPath,
    );
    url.searchParams.set(p.skuParameter, externalSku);
    const response = await apiJson<Record<string, unknown>>(
      url.toString(),
      { headers: { "CJ-Access-Token": this.token } },
      this.transport,
    );
    let rows: unknown = response;
    for (const part of p.rowsPath.split(".")) {
      if (!rows || typeof rows !== "object")
        throw new IntegrationError(
          "PAYLOAD",
          "CJ inventory response does not match the confirmed profile",
        );
      rows = (rows as Record<string, unknown>)[part];
    }
    if (!Array.isArray(rows))
      throw new IntegrationError(
        "PAYLOAD",
        "CJ inventory response must contain rows",
      );
    return rows.map((row) => {
      const r = row as Record<string, unknown>,
        available = Number(r[p.availableField]);
      if (
        !Number.isSafeInteger(available) ||
        available < 0 ||
        typeof r[p.warehouseField] !== "string"
      )
        throw new IntegrationError(
          "PAYLOAD",
          "CJ warehouse or availability semantics need review",
        );
      return { warehouseId: String(r[p.warehouseField]), available, raw: r };
    });
  }
}
