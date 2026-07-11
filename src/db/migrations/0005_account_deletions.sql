-- Durable deletion receipt deliberately has no creator FK so completion and
-- vendor/on-chain residual disclosures survive the creator cascade.
CREATE TABLE account_deletions (
  creator_id UUID PRIMARY KEY,
  privy_user_id TEXT,
  agent_wallet_id TEXT,
  wallet_address TEXT,
  state TEXT NOT NULL DEFAULT 'requested',
  residuals JSONB NOT NULL DEFAULT '[]',
  error TEXT,
  status_token_hash TEXT NOT NULL,
  status_token_expires_at TIMESTAMPTZ NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT account_deletions_state_check CHECK (
    state IN ('requested', 'revoking-connections', 'deleting', 'completed', 'retryable-failure')
  )
);

CREATE INDEX idx_account_deletions_state_updated_at ON account_deletions(state, updated_at);
CREATE UNIQUE INDEX idx_account_deletions_status_token_hash ON account_deletions(status_token_hash);
ALTER TABLE account_deletions ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_account_deletions ON account_deletions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY deny_anon_account_deletions ON account_deletions FOR ALL TO anon USING (false);
CREATE TRIGGER trg_account_deletions_updated_at BEFORE UPDATE ON account_deletions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
