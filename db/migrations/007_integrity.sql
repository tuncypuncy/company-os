ALTER TABLE orders ADD COLUMN fees_status text NOT NULL DEFAULT 'UNAVAILABLE';
UPDATE orders SET fees_status='DEMO' WHERE source='DEMO';
ALTER TABLE order_costs ADD COLUMN input_snapshot jsonb NOT NULL DEFAULT '{}';
CREATE TABLE purchase_plan (id text PRIMARY KEY, store_id text NOT NULL REFERENCES stores(id), purchase_order_id text NOT NULL UNIQUE REFERENCES purchase_orders(id), lead_days integer CHECK(lead_days>=0), source text NOT NULL, notes text NOT NULL DEFAULT '');
CREATE TRIGGER order_audit AFTER INSERT OR UPDATE OR DELETE ON orders FOR EACH ROW EXECUTE FUNCTION audit_financial_change();
CREATE TRIGGER fx_audit AFTER INSERT OR UPDATE OR DELETE ON fx_rates FOR EACH ROW EXECUTE FUNCTION audit_financial_change();
REVOKE ALL ON ALL TABLES IN SCHEMA company_os FROM PUBLIC;
