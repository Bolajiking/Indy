-- Indyfren Database Schema
-- Run via: npm run db:init
-- Ordered migrations are authoritative for upgrades; this clean-install snapshot is generated
-- and must be updated (including ledger checksums below) with every migration.

-- Creators table
CREATE TABLE IF NOT EXISTS creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  privy_user_id TEXT UNIQUE,
  telegram_chat_id TEXT UNIQUE,
  whatsapp_phone TEXT UNIQUE,
  display_name TEXT NOT NULL,
  niche TEXT,
  wallet_id TEXT,
  wallet_address TEXT,
  account_status TEXT NOT NULL DEFAULT 'active',
  deletion_requested_at TIMESTAMPTZ,
  free_credits_remaining_cents INTEGER DEFAULT 1000,
  monthly_spend_cents INTEGER DEFAULT 0,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Platform connections table
CREATE TABLE IF NOT EXISTS platform_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  platform_user_id TEXT,
  platform_username TEXT,
  metadata JSONB DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  key_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(creator_id, platform)
);

-- Deals table
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  brand_contact_email TEXT,
  brand_contact_name TEXT,
  brand_domain TEXT,
  stage TEXT NOT NULL DEFAULT 'discovered',
  fit_score INTEGER,
  estimated_value_cents INTEGER,
  actual_value_cents INTEGER,
  source_url TEXT,
  source_type TEXT,
  source_confidence INTEGER,
  source_evidence JSONB DEFAULT '[]',
  deliverables JSONB DEFAULT '[]',
  deadline_at TIMESTAMPTZ,
  follow_up_at TIMESTAMPTZ,
  probability INTEGER,
  next_action TEXT,
  agent_provenance JSONB DEFAULT '{}',
  archived_at TIMESTAMPTZ,
  pitch_text TEXT,
  pitch_sent_at TIMESTAMPTZ,
  response_text TEXT,
  responded_at TIMESTAMPTZ,
  contract_notes TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'USD',
  description TEXT NOT NULL,
  service TEXT,
  tx_hash TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment attempts table (tracks the full MPP lifecycle, including failures)
CREATE TABLE IF NOT EXISTS payment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  service_url TEXT NOT NULL,
  service_host TEXT NOT NULL,
  method TEXT,
  intent TEXT,
  currency TEXT,
  quoted_amount_cents INTEGER,
  actual_amount_cents INTEGER,
  status TEXT NOT NULL,
  challenge_id TEXT,
  receipt_reference TEXT,
  tx_hash TEXT,
  error TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent actions table
CREATE TABLE IF NOT EXISTS agent_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  description TEXT NOT NULL,
  input JSONB,
  output JSONB,
  cost_cents INTEGER DEFAULT 0,
  requires_approval BOOLEAN DEFAULT false,
  approved_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table (for conversation history persistence)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messaging link sessions table (one-time dashboard-to-chat linking)
CREATE TABLE IF NOT EXISTS messaging_link_sessions (
  id UUID PRIMARY KEY,
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  consumed_by_platform_user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Creator memories table (per-creator agent memory for self-improvement)
CREATE TABLE IF NOT EXISTS creator_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL, -- 'preference', 'pattern', 'outcome', 'context', 'learned'
  skill TEXT, -- null = global memory, skill name = skill-specific memory
  key TEXT NOT NULL, -- short identifier for this memory
  content TEXT NOT NULL, -- the memory content
  confidence REAL DEFAULT 1.0, -- how confident the agent is (0-1)
  times_reinforced INTEGER DEFAULT 1,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(creator_id, skill, key)
);

-- Skill outcomes table (tracks results for self-improvement)
CREATE TABLE IF NOT EXISTS skill_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  skill TEXT NOT NULL,
  action_id UUID REFERENCES agent_actions(id) ON DELETE SET NULL,
  input_summary TEXT,
  output_summary TEXT,
  success BOOLEAN NOT NULL,
  creator_feedback TEXT, -- explicit feedback from creator
  creator_rating INTEGER, -- 1-5 rating from creator
  learnings TEXT, -- what the agent extracted from this outcome
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Durable webhook receipt ledger (provider event IDs make ingestion idempotent)
CREATE TABLE IF NOT EXISTS webhook_events (
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

-- Indexes (IF NOT EXISTS requires Postgres 9.5+)
CREATE INDEX IF NOT EXISTS idx_creators_telegram_chat_id ON creators(telegram_chat_id);
CREATE INDEX IF NOT EXISTS idx_creators_whatsapp_phone ON creators(whatsapp_phone);
CREATE INDEX IF NOT EXISTS idx_creators_privy_user_id ON creators(privy_user_id);
CREATE INDEX IF NOT EXISTS idx_deals_creator_id ON deals(creator_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_transactions_creator_id ON transactions(creator_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_creator_id ON payment_attempts(creator_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_status ON payment_attempts(status);
CREATE INDEX IF NOT EXISTS idx_agent_actions_creator_id ON agent_actions(creator_id);
CREATE INDEX IF NOT EXISTS idx_agent_actions_status ON agent_actions(status);
CREATE INDEX IF NOT EXISTS idx_messages_creator_id ON messages(creator_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messaging_link_sessions_creator_id ON messaging_link_sessions(creator_id);
CREATE INDEX IF NOT EXISTS idx_messaging_link_sessions_expires_at ON messaging_link_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_creator_memories_creator_id ON creator_memories(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_memories_skill ON creator_memories(creator_id, skill);
CREATE INDEX IF NOT EXISTS idx_skill_outcomes_creator_skill ON skill_outcomes(creator_id, skill);
CREATE INDEX IF NOT EXISTS idx_skill_outcomes_created_at ON skill_outcomes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status_created_at ON webhook_events(status, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_actions_expires_at ON agent_actions(expires_at);
CREATE INDEX IF NOT EXISTS idx_creators_account_status ON creators(account_status);

-- Enable Row Level Security on all tables
ALTER TABLE creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE messaging_link_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- RLS policies: allow service_role full access (backend uses service key)
-- These are no-ops for service_role but protect against anon-key access.
DO $$ BEGIN
  -- Creators
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_creators') THEN
    CREATE POLICY service_role_creators ON creators FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'deny_anon_creators') THEN
    CREATE POLICY deny_anon_creators ON creators FOR ALL TO anon USING (false);
  END IF;

  -- Platform connections
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_platform_connections') THEN
    CREATE POLICY service_role_platform_connections ON platform_connections FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'deny_anon_platform_connections') THEN
    CREATE POLICY deny_anon_platform_connections ON platform_connections FOR ALL TO anon USING (false);
  END IF;

  -- Deals
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_deals') THEN
    CREATE POLICY service_role_deals ON deals FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'deny_anon_deals') THEN
    CREATE POLICY deny_anon_deals ON deals FOR ALL TO anon USING (false);
  END IF;

  -- Transactions
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_transactions') THEN
    CREATE POLICY service_role_transactions ON transactions FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'deny_anon_transactions') THEN
    CREATE POLICY deny_anon_transactions ON transactions FOR ALL TO anon USING (false);
  END IF;

  -- Agent actions
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_payment_attempts') THEN
    CREATE POLICY service_role_payment_attempts ON payment_attempts FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'deny_anon_payment_attempts') THEN
    CREATE POLICY deny_anon_payment_attempts ON payment_attempts FOR ALL TO anon USING (false);
  END IF;

  -- Agent actions
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_agent_actions') THEN
    CREATE POLICY service_role_agent_actions ON agent_actions FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'deny_anon_agent_actions') THEN
    CREATE POLICY deny_anon_agent_actions ON agent_actions FOR ALL TO anon USING (false);
  END IF;

  -- Messages
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_messages') THEN
    CREATE POLICY service_role_messages ON messages FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'deny_anon_messages') THEN
    CREATE POLICY deny_anon_messages ON messages FOR ALL TO anon USING (false);
  END IF;

  -- Creator memories
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_creator_memories') THEN
    CREATE POLICY service_role_creator_memories ON creator_memories FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'deny_anon_creator_memories') THEN
    CREATE POLICY deny_anon_creator_memories ON creator_memories FOR ALL TO anon USING (false);
  END IF;

  -- Skill outcomes
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_skill_outcomes') THEN
    CREATE POLICY service_role_skill_outcomes ON skill_outcomes FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'deny_anon_skill_outcomes') THEN
    CREATE POLICY deny_anon_skill_outcomes ON skill_outcomes FOR ALL TO anon USING (false);
  END IF;

  -- Messaging link sessions
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_messaging_link_sessions') THEN
    CREATE POLICY service_role_messaging_link_sessions ON messaging_link_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'deny_anon_messaging_link_sessions') THEN
    CREATE POLICY deny_anon_messaging_link_sessions ON messaging_link_sessions FOR ALL TO anon USING (false);
  END IF;

  -- Webhook events
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_webhook_events') THEN
    CREATE POLICY service_role_webhook_events ON webhook_events FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'deny_anon_webhook_events') THEN
    CREATE POLICY deny_anon_webhook_events ON webhook_events FOR ALL TO anon USING (false);
  END IF;
END $$;

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_creators_updated_at') THEN
    CREATE TRIGGER trg_creators_updated_at BEFORE UPDATE ON creators FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_deals_updated_at') THEN
    CREATE TRIGGER trg_deals_updated_at BEFORE UPDATE ON deals FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_creator_memories_updated_at') THEN
    CREATE TRIGGER trg_creator_memories_updated_at BEFORE UPDATE ON creator_memories FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_webhook_events_updated_at') THEN
    CREATE TRIGGER trg_webhook_events_updated_at BEFORE UPDATE ON webhook_events FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- Atomic credit deduction function (prevents race conditions)
CREATE OR REPLACE FUNCTION deduct_credits(creator_id UUID, amount INTEGER)
RETURNS TABLE(
  out_id UUID,
  out_credits INTEGER
) AS $$
  UPDATE creators
  SET free_credits_remaining_cents = GREATEST(free_credits_remaining_cents - amount, 0)
  WHERE creators.id = creator_id
  RETURNING creators.id, creators.free_credits_remaining_cents;
$$ LANGUAGE sql VOLATILE;

-- Snapshot-to-migration handoff. A database installed from this file is current
-- through 0002 and can immediately use db:migrate or db:migrate:check.
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (version, checksum) VALUES
  ('0001', 'f25973b7b0b2b04459305c94f512ee39372c48773846fb52c935d8526180de94'),
  ('0002', '5db66ca0b1b621fe83e3cdb7856f5bbac594c77bde01b7c6904921cc1481d906')
ON CONFLICT (version) DO NOTHING;

DO $$
DECLARE
  drift_version TEXT;
BEGIN
  SELECT version INTO drift_version
  FROM schema_migrations
  WHERE
    (version = '0001' AND checksum <> 'f25973b7b0b2b04459305c94f512ee39372c48773846fb52c935d8526180de94')
    OR
    (version = '0002' AND checksum <> '5db66ca0b1b621fe83e3cdb7856f5bbac594c77bde01b7c6904921cc1481d906')
  LIMIT 1;

  IF drift_version IS NOT NULL THEN
    RAISE EXCEPTION 'schema_migrations checksum drift for version %', drift_version;
  END IF;
END $$;
