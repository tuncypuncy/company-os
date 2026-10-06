import { z } from "zod";
import { apiJson, IntegrationError, type Transport } from "./http";
export const metaConfig = z
  .object({
    accountId: z.string().regex(/^act_\d+$/),
    apiVersion: z.string().regex(/^v\d+\.\d+$/),
    tokenEnv: z.string().regex(/^META_[A-Z0-9_]+$/),
    entityId: z.string().min(1),
  })
  .strict();
export type MetaConfig = z.infer<typeof metaConfig>;
export class MetaAdapter {
  constructor(
    readonly config: MetaConfig,
    private token: string,
    private transport: Transport = fetch,
  ) {}
  private async request<T>(path: string, params: Record<string, string> = {}) {
    const url = new URL(
      `https://graph.facebook.com/${this.config.apiVersion}/${path}`,
    );
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return apiJson<T>(
      url.toString(),
      { headers: { Authorization: "Bearer " + this.token } },
      this.transport,
    );
  }
  check() {
    return this.request<{
      id: string;
      name: string;
      currency: string;
      account_status: number;
    }>(this.config.accountId, { fields: "id,name,currency,account_status" });
  }
  async spend(since: string, until: string, after?: string) {
    const result = await this.request<{
      data: {
        date_start: string;
        date_stop: string;
        spend: string;
        account_currency: string;
      }[];
      paging?: { cursors?: { after: string }; next?: string };
    }>(this.config.accountId + "/insights", {
      fields: "date_start,date_stop,spend,account_currency",
      level: "account",
      time_increment: "1",
      time_range: JSON.stringify({ since, until }),
      limit: "100",
      ...(after ? { after } : {}),
    });
    return {
      records: result.data,
      cursor: result.paging?.next
        ? (result.paging.cursors?.after ?? null)
        : null,
    };
  }
  async budgets(after?: string) {
    return this.request<{
      data: {
        id: string;
        name: string;
        daily_budget?: string;
        status: string;
      }[];
      paging?: { cursors?: { after: string }; next?: string };
    }>(this.config.accountId + "/adsets", {
      fields: "id,name,daily_budget,status",
      limit: "100",
      ...(after ? { after } : {}),
    });
  }
  // Ad-account spend_cap/balance are not assumed to be a credit facility. Billing credit remains reviewed manual/invoice data.
}
