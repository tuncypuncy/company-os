CREATE TABLE expense_attachments (
 id text PRIMARY KEY, expense_id text NOT NULL REFERENCES expenses(id),
 original_name text NOT NULL, mime_type text NOT NULL, storage_key text NOT NULL UNIQUE,
 size_bytes integer NOT NULL CHECK(size_bytes>0), sha256 text NOT NULL,
 storage_provider text NOT NULL CHECK(storage_provider IN ('local','supabase')),
 storage_bucket text, created_by text NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((storage_provider='local' AND storage_bucket IS NULL) OR (storage_provider='supabase' AND storage_bucket IS NOT NULL)),
 UNIQUE(expense_id,sha256)
);
REVOKE ALL ON expense_attachments FROM PUBLIC;
CREATE TRIGGER expense_evidence_audit AFTER INSERT OR UPDATE OR DELETE ON expense_attachments FOR EACH ROW EXECUTE FUNCTION audit_financial_change();
