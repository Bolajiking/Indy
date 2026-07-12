-- A receipt may start an external side effect just before its worker times out
-- or loses the write that would record success. Keep a token-bound durable
-- lease and outcome so automatic retries never duplicate that side effect.
ALTER TABLE webhook_events
  ADD COLUMN delivery_lease_token UUID,
  ADD COLUMN delivery_started_at TIMESTAMPTZ,
  ADD COLUMN delivery_outcome TEXT NOT NULL DEFAULT 'pending',
  ADD CONSTRAINT webhook_events_status_check
    CHECK (status IN ('queued', 'processing', 'processed', 'failed', 'outcome_unknown')),
  ADD CONSTRAINT webhook_events_delivery_outcome_check
    CHECK (delivery_outcome IN ('pending', 'confirmed', 'unknown'));

CREATE INDEX idx_webhook_events_reconciliation
  ON webhook_events(status, delivery_outcome, delivery_started_at)
  WHERE status = 'outcome_unknown';
