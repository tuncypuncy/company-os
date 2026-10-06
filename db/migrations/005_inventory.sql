ALTER TABLE variants ADD COLUMN bundle_size integer NOT NULL DEFAULT 1 CHECK(bundle_size>0);
ALTER TABLE meta_billing_accounts ADD COLUMN clearing_days numeric CHECK(clearing_days>=0);
ALTER TABLE inbound_shipments ADD COLUMN store_id text REFERENCES stores(id);
ALTER TABLE inbound_shipments ADD COLUMN legal_entity_id text REFERENCES legal_entities(id);
ALTER TABLE inbound_shipments ADD COLUMN obligation_id text UNIQUE REFERENCES obligations(id);
ALTER TABLE inventory_snapshots ADD CONSTRAINT inventory_available_nonnegative CHECK(available IS NULL OR available>=0);
CREATE INDEX inventory_latest ON inventory_snapshots(supplier_sku_id,warehouse_id,observed_at DESC);
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['vendors','warehouses','supplier_skus','variants','inventory_snapshots','inbound_shipments','shipment_items','shipment_events','products','cash_accounts','ad_spend'] LOOP EXECUTE format('CREATE TRIGGER operations_audit AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_financial_change()',t); END LOOP; END $$;
