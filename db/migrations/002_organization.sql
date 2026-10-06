-- Confirmed organizational context only. Ownership, currencies and accounts remain unmapped.
INSERT INTO legal_entities(id,name,jurisdiction,entity_type) VALUES ('omurtak','Omurtak B.V.','Netherlands','B.V.'),('softdance','Softdance LLC','Wyoming, United States','LLC') ON CONFLICT DO NOTHING;
INSERT INTO brands(id,name) VALUES ('godisabove','Godisabove'),('360-faucet','360 Faucet') ON CONFLICT DO NOTHING;
INSERT INTO stores(id,brand_id,name,accent_color) VALUES ('gia','godisabove','Godisabove','#FFD602'),('gia-usa','godisabove','Godisabove USA','#877AF5'),('faucet','360-faucet','360 Faucet','#C3C8D2') ON CONFLICT DO NOTHING;
INSERT INTO products(id,brand_id,name,status) VALUES ('jar','godisabove','Bible Verse Jar','UNMAPPED'),('trivia','godisabove','Bible Trivia','UNMAPPED'),('cards','godisabove','Women''s Cards','UNMAPPED') ON CONFLICT DO NOTHING;
CREATE UNIQUE INDEX cash_account_identity ON cash_accounts(legal_entity_id,store_id,currency,name);
