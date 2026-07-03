-- Public-launch schema additions. The clean-install snapshot in ../schema.sql
-- is kept in sync with all migrations through this version.
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider, provider_event_id)
);

ALTER TABLE agent_actions ADD COLUMN expires_at TIMESTAMPTZ;
ALTER TABLE platform_connections ADD COLUMN key_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE creators ADD COLUMN account_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE creators ADD COLUMN deletion_requested_at TIMESTAMPTZ;

CREATE INDEX idx_webhook_events_status_created_at ON webhook_events(status, created_at);
CREATE INDEX idx_agent_actions_expires_at ON agent_actions(expires_at);
CREATE INDEX idx_creators_account_status ON creators(account_status);

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_webhook_events ON webhook_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY deny_anon_webhook_events ON webhook_events FOR ALL TO anon USING (false);

CREATE TRIGGER trg_webhook_events_updated_at BEFORE UPDATE ON webhook_events FOR EACH ROW EXECUTE FUNCTION update_updated_at();
