ALTER TABLE invoice_attachments ADD COLUMN storage_provider text NOT NULL DEFAULT 'local' CHECK (storage_provider IN ('local','supabase'));
ALTER TABLE invoice_attachments ADD COLUMN storage_bucket text;
ALTER TABLE invoice_attachments ADD CONSTRAINT attachment_storage_location CHECK ((storage_provider='local' AND storage_bucket IS NULL) OR (storage_provider='supabase' AND storage_bucket IS NOT NULL));
