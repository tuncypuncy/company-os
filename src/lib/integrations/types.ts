export type Platform =
  | "SHOPIFY"
  | "META"
  | "CJ"
  | "GOOGLE"
  | "TRIPLE_WHALE"
  | "AMAZON";
export type IntegrationCapabilities = {
  orders: boolean;
  refunds: boolean;
  catalog: boolean;
  spend: boolean;
  budgets: boolean;
  credit: boolean;
  inventory: boolean;
  inbound: boolean;
  settlements: boolean;
  webhooks: boolean;
};
export type SyncCursor = {
  accountId: string;
  cursor: string | null;
  lastSuccessAt: string | null;
};
export type SourceRecord<T> = {
  externalId: string;
  accountId: string;
  source: Platform;
  observedAt: string;
  payload: T;
};
export interface IntegrationAdapter<T> {
  platform: Platform;
  capabilities: IntegrationCapabilities;
  sync(
    cursor: SyncCursor,
  ): Promise<{ records: SourceRecord<T>[]; nextCursor: string | null }>;
}
export class IntegrationUnavailable extends Error {
  constructor(platform: Platform) {
    super(`${platform} is not connected. No data was fabricated.`);
  }
}
// Real adapters must declare verified capabilities. This explicit unavailable adapter is never a live feed.
export function unavailableAdapter(
  platform: Platform,
): IntegrationAdapter<never> {
  return {
    platform,
    capabilities: {
      orders: false,
      refunds: false,
      catalog: false,
      spend: false,
      budgets: false,
      credit: false,
      inventory: false,
      inbound: false,
      settlements: false,
      webhooks: false,
    },
    async sync() {
      throw new IntegrationUnavailable(platform);
    },
  };
}
