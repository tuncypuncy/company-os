import type { Database } from "./db";
export async function seedDemo(db: Database) {
  if (
    (await db.query("SELECT id FROM users WHERE id='demo-owner'")).rows.length
  )
    return;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  await db.transaction(async (tx) => {
    await tx.query(
      "INSERT INTO users(id,email,name,role,is_demo) VALUES ('demo-owner','demo@company-os.local','Demo Owner','OWNER',true)",
    );
    await tx.query(
      "INSERT INTO legal_entities(id,name,jurisdiction,entity_type) VALUES ('omurtak','Omurtak B.V.','Netherlands','B.V.'),('softdance','Softdance LLC','Wyoming, United States','LLC') ON CONFLICT DO NOTHING",
    );
    await tx.query(
      "INSERT INTO brands(id,name) VALUES ('godisabove','Godisabove'),('360-faucet','360 Faucet') ON CONFLICT DO NOTHING",
    );
    await tx.query(
      "INSERT INTO stores(id,brand_id,name,accent_color) VALUES ('gia','godisabove','Godisabove','#FFD602'),('gia-usa','godisabove','Godisabove USA','#877AF5'),('faucet','360-faucet','360 Faucet','#C3C8D2') ON CONFLICT DO NOTHING",
    );
    await tx.query(
      "INSERT INTO products(id,brand_id,name,status) VALUES ('jar','godisabove','Bible Verse Jar','DEMO'),('trivia','godisabove','Bible Trivia','DEMO'),('cards','godisabove','Women''s Cards','DEMO') ON CONFLICT DO NOTHING",
    );
    await tx.query(
      "INSERT INTO product_aliases(id,product_id,alias) VALUES ('alias-jar','jar','Jar'),('alias-bible','jar','Bible Jar'),('alias-scripture','jar','Scripture Jar')",
    );
    const date = today.toISOString().slice(0, 10);
    for (const [idx, store] of ["gia", "gia-usa"].entries()) {
      const entity = idx ? "softdance" : "omurtak";
      const factor = idx ? 0.7 : 1;
      await tx.query(
        "INSERT INTO cash_accounts(id,legal_entity_id,store_id,name,currency) VALUES($1,$2,$3,$4,$5)",
        [`cash-${store}`, entity, store, "DEMO operating account", "USD"],
      );
      await tx.query(
        "INSERT INTO cash_balance_snapshots(id,account_id,available_minor,pending_minor,source,status,observed_at) VALUES($1,$2,$3,$4,'DEMO','DEMO',$5)",
        [
          `balance-${store}`,
          `cash-${store}`,
          Math.round(24600000 * factor),
          Math.round(1200000 * factor),
          today.toISOString(),
        ],
      );
      await tx.query(
        "INSERT INTO ad_accounts(id,platform,store_id,legal_entity_id,currency) VALUES($1,'META',$2,$3,'USD'),($4,'GOOGLE',$2,$3,'USD')",
        [`meta-${store}`, store, entity, `google-${store}`],
      );
      await tx.query(
        "INSERT INTO ad_budgets(id,account_id,daily_minor,effective_at,source) VALUES($1,$2,$3,$4,'DEMO')",
        [
          `budget-${store}`,
          `meta-${store}`,
          Math.round(4000000 * factor),
          today.toISOString(),
        ],
      );
      await tx.query(
        "INSERT INTO meta_billing_accounts(id,ad_account_id,legal_entity_id,name,currency) VALUES($1,$2,$3,'DEMO credit facility','USD')",
        [`billing-${store}`, `meta-${store}`, entity],
      );
      await tx.query(
        "INSERT INTO meta_credit_snapshots(id,billing_account_id,limit_minor,outstanding_minor,observed_at,source,status) VALUES($1,$2,$3,$4,$5,'DEMO','DEMO')",
        [
          `credit-${store}`,
          `billing-${store}`,
          Math.round(40000000 * factor),
          Math.round(29600000 * factor),
          today.toISOString(),
        ],
      );
      for (const [product, price] of [
        ["jar", 550],
        ["trivia", 740],
        ["cards", 420],
      ] as const) {
        await tx.query(
          "INSERT INTO cost_rules(id,product_id,store_id,legal_entity_id,bundle_quantity,currency,product_minor,packaging_minor,fulfillment_minor,shipping_minor,other_minor,effective_start,source,status) VALUES($1,$2,$3,$4,2,'USD',$5,35,80,210,0,$6,'DEMO','DEMO')",
          [
            `rule-${store}-${product}`,
            product,
            store,
            entity,
            price,
            "2020-01-01",
          ],
        );
      }
      for (let day = 27; day >= 0; day--) {
        const stamp = new Date(today.getTime() - day * 86400000);
        const d = stamp.toISOString().slice(0, 10);
        const growth = 1 - day * 0.008;
        for (let j = 0; j < 12; j++) {
          const product = ["jar", "trivia", "cards"][j % 3];
          const oid = `demo-${store}-${day}-${j}`;
          const bundles = Math.round((idx ? 110 : 155) * growth);
          await tx.query(
            "INSERT INTO orders(id,store_id,legal_entity_id,external_id,ordered_at,currency,gross_minor,discount_minor,platform_refund_minor,internal_refund_minor,processing_minor,source,status) VALUES($1,$2,$3,$1,$4,'USD',$5,$6,$7,$8,$9,'DEMO','DEMO')",
            [
              oid,
              store,
              entity,
              `${d}T00:00:00Z`,
              bundles * 6990,
              bundles * 110,
              bundles * 75,
              bundles * 90,
              bundles * 160,
            ],
          );
          await tx.query(
            "INSERT INTO order_items(id,order_id,product_id,quantity,bundle_quantity) VALUES($1,$2,$3,$4,2)",
            [`${oid}-item`, oid, product, bundles * 2],
          );
        }
        for (const [platform, amount] of [
          ["meta", 4000000],
          ["google", 400000],
        ] as const)
          await tx.query(
            "INSERT INTO ad_spend(id,account_id,spend_date,actual_minor,source,status) VALUES($1,$2,$3,$4,'DEMO','DEMO')",
            [
              `spend-${store}-${day}-${platform}`,
              `${platform}-${store}`,
              d,
              Math.round(amount * factor * growth),
            ],
          );
      }
      for (const [j, title, category, hours, amount] of [
        [0, "DEMO supplier batch", "Inventory", 18, 2800000],
        [1, "DEMO team payroll", "Payroll", 42, 3400000],
        [2, "DEMO Meta invoice", "Advertising", 66, 3400000],
        [3, "DEMO freight payment", "Shipping", 120, 8400000],
      ] as const) {
        await tx.query(
          "INSERT INTO obligations(id,legal_entity_id,store_id,title,category,currency,amount_minor,due_at,status,source,verification_status,created_by) VALUES($1,$2,$3,$4,$5,'USD',$6,$7,'SCHEDULED','DEMO','DEMO','demo-owner')",
          [
            `ob-${store}-${j}`,
            entity,
            store,
            title,
            category,
            Math.round(amount * factor),
            new Date(today.getTime() + hours * 3600000).toISOString(),
          ],
        );
      }
      await tx.query(
        "INSERT INTO expected_inflows(id,legal_entity_id,store_id,title,amount_minor,currency,expected_at,source,status) VALUES($1,$2,$3,'DEMO settlement', $4,'USD',$5,'DEMO','ESTIMATED')",
        [
          `in-${store}`,
          entity,
          store,
          Math.round(7800000 * factor),
          new Date(today.getTime() + 90 * 3600000).toISOString(),
        ],
      );
      await tx.query(
        "INSERT INTO recurring_expenses(id,legal_entity_id,store_id,vendor,category,amount_minor,currency,frequency,next_due,source,last_verified_at) VALUES($1,$2,$3,'DEMO application subscription','SaaS',9900,'USD','MONTHLY',$4,'DEMO',$5)",
        [`rec-${store}`, entity, store, date, today.toISOString()],
      );
    }
    for (const platform of [
      "Shopify",
      "Meta",
      "CJ",
      "Google",
      "Triple Whale",
      "Amazon",
      "Banks",
    ])
      await tx.query(
        "INSERT INTO integration_connections(id,platform,status) VALUES($1,$2,'UNAVAILABLE')",
        [platform.toLowerCase().replaceAll(" ", "-"), platform],
      );
  });
}
