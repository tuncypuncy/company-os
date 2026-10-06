CREATE TABLE scenarios (id text PRIMARY KEY, store_id text NOT NULL REFERENCES stores(id), legal_entity_id text REFERENCES legal_entities(id), currency text NOT NULL, inputs jsonb NOT NULL, results jsonb NOT NULL, created_by text NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), calculation_version text NOT NULL);
CREATE TABLE integration_events (id text PRIMARY KEY, connection_id text NOT NULL REFERENCES integration_connections(id), external_event_id text NOT NULL, topic text NOT NULL, payload jsonb NOT NULL, received_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz, status text NOT NULL DEFAULT 'RECEIVED', UNIQUE(connection_id,external_event_id));
ALTER TABLE integration_connections ADD COLUMN config jsonb NOT NULL DEFAULT '{}';
ALTER TABLE integration_connections ADD COLUMN last_success_at timestamptz;
ALTER TABLE integration_connections ADD COLUMN last_error text;
ALTER TABLE integration_connections ADD COLUMN freshness_hours integer NOT NULL DEFAULT 24;
CREATE TABLE raw_source_records (id text PRIMARY KEY, connection_id text NOT NULL REFERENCES integration_connections(id), kind text NOT NULL, external_id text NOT NULL, payload jsonb NOT NULL, observed_at timestamptz NOT NULL, UNIQUE(connection_id,kind,external_id));
CREATE TABLE alert_acknowledgements (alert_key text PRIMARY KEY, acknowledged_by text NOT NULL REFERENCES users(id), acknowledged_at timestamptz NOT NULL DEFAULT now(), reason text NOT NULL);
REVOKE ALL ON ALL TABLES IN SCHEMA company_os FROM PUBLIC;
