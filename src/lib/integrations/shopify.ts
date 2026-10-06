import { createHmac, timingSafeEqual } from "node:crypto";
import { apiJson, IntegrationError, type Transport } from "./http";
import { z } from "zod";
export const shopifyConfig = z
  .object({
    shopDomain: z.string().regex(/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/),
    apiVersion: z.string().regex(/^20\d{2}-(01|04|07|10)$/),
    tokenEnv: z.string().regex(/^SHOPIFY_[A-Z0-9_]+$/),
    webhookSecretEnv: z.string().regex(/^SHOPIFY_[A-Z0-9_]+$/),
    entityId: z.string().min(1),
    includeShipping: z.boolean().default(false),
  })
  .strict();
export type ShopifyConfig = z.infer<typeof shopifyConfig>;
export type Money = { amount: string; currencyCode: string };
export type ShopifyProduct = {
  id: string;
  title: string;
  status: string;
  variants: {
    nodes: { id: string; sku: string | null }[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
};
export type ShopifyOrder = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  subtotalPriceSet: { shopMoney: Money };
  totalDiscountsSet: { shopMoney: Money };
  totalShippingPriceSet: { shopMoney: Money };
  lineItems: {
    nodes: {
      id: string;
      quantity: number;
      sku: string | null;
      variant: { id: string; product: { id: string; title: string } } | null;
    }[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
  refunds: {
    id: string;
    createdAt: string;
    totalRefundedSet: { shopMoney: Money };
  }[];
};
export function verifyShopifySignature(
  bytes: Buffer,
  provided: string | null,
  secret: string,
) {
  if (!provided) return false;
  try {
    const expected = createHmac("sha256", secret).update(bytes).digest();
    const received = Buffer.from(provided, "base64");
    return (
      received.length === expected.length && timingSafeEqual(expected, received)
    );
  } catch {
    return false;
  }
}
export class ShopifyAdapter {
  constructor(
    readonly config: ShopifyConfig,
    private token: string,
    private transport: Transport = fetch,
  ) {}
  async query<T>(query: string, variables: Record<string, unknown> = {}) {
    const result = await apiJson<{ data?: T; errors?: unknown[] }>(
      `https://${this.config.shopDomain}/admin/api/${this.config.apiVersion}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": this.token,
        },
        body: JSON.stringify({ query, variables }),
      },
      this.transport,
    );
    if (result.errors?.length || !result.data)
      throw new IntegrationError(
        "GRAPHQL",
        "Shopify GraphQL request failed; verify selected API version and scopes",
      );
    return result.data;
  }
  async check() {
    return this.query<{
      shop: { id: string; name: string; currencyCode: string };
    }>("{ shop { id name currencyCode } }");
  }
  async products(cursor: string | null = null) {
    const result = await this.query<{
      products: {
        nodes: ShopifyProduct[];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    }>(
      "query Catalog($cursor:String){products(first:50,after:$cursor){nodes{id title status variants(first:100){nodes{id sku} pageInfo{hasNextPage endCursor}}} pageInfo{hasNextPage endCursor}}}",
      { cursor },
    );
    for (const product of result.products.nodes) {
      let pages = 0;
      while (product.variants.pageInfo.hasNextPage) {
        if (++pages > 100)
          throw new IntegrationError(
            "PAGINATION",
            "Variant page safety limit exceeded",
          );
        const more = await this.query<{
          product: { variants: ShopifyProduct["variants"] };
        }>(
          "query Variants($id:ID!,$cursor:String){product(id:$id){variants(first:100,after:$cursor){nodes{id sku} pageInfo{hasNextPage endCursor}}}}",
          { id: product.id, cursor: product.variants.pageInfo.endCursor },
        );
        product.variants.nodes.push(...more.product.variants.nodes);
        product.variants.pageInfo = more.product.variants.pageInfo;
      }
    }
    return result.products;
  }
  async orders(since: string, cursor: string | null = null) {
    const result = await this.query<{
      orders: {
        nodes: ShopifyOrder[];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    }>(
      "query Orders($cursor:String,$filter:String!){orders(first:50,after:$cursor,query:$filter,sortKey:UPDATED_AT){nodes{id name createdAt updatedAt cancelledAt subtotalPriceSet{shopMoney{amount currencyCode}} totalDiscountsSet{shopMoney{amount currencyCode}} totalShippingPriceSet{shopMoney{amount currencyCode}} lineItems(first:100){nodes{id quantity sku variant{id product{id title}}} pageInfo{hasNextPage endCursor}} refunds{id createdAt totalRefundedSet{shopMoney{amount currencyCode}}}} pageInfo{hasNextPage endCursor}}}",
      { cursor, filter: "updated_at:>=" + since },
    );
    for (const order of result.orders.nodes) {
      let pages = 0;
      while (order.lineItems.pageInfo.hasNextPage) {
        if (++pages > 100)
          throw new IntegrationError(
            "PAGINATION",
            "Order-line safety limit exceeded",
          );
        const more = await this.query<{
          order: { lineItems: ShopifyOrder["lineItems"] };
        }>(
          "query Lines($id:ID!,$cursor:String){order(id:$id){lineItems(first:100,after:$cursor){nodes{id quantity sku variant{id product{id title}}} pageInfo{hasNextPage endCursor}}}}",
          { id: order.id, cursor: order.lineItems.pageInfo.endCursor },
        );
        order.lineItems.nodes.push(...more.order.lineItems.nodes);
        order.lineItems.pageInfo = more.order.lineItems.pageInfo;
      }
    }
    return result.orders;
  }
}
