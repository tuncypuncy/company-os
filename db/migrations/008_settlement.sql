ALTER TABLE orders ADD COLUMN financial_status text NOT NULL DEFAULT 'UNKNOWN';
CREATE TABLE obligation_payments (id text PRIMARY KEY, obligation_id text NOT NULL REFERENCES obligations(id), amount_minor bigint NOT NULL CHECK(amount_minor>0), paid_at timestamptz NOT NULL, source text NOT NULL, reference text NOT NULL, created_by text NOT NULL REFERENCES users(id), UNIQUE(obligation_id,reference));
CREATE TRIGGER payment_audit AFTER INSERT OR UPDATE OR DELETE ON obligation_payments FOR EACH ROW EXECUTE FUNCTION audit_financial_change();
REVOKE ALL ON ALL TABLES IN SCHEMA company_os FROM PUBLIC;
