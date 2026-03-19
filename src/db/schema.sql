-- Indyfren Database Schema

-- Creators table
CREATE TABLE creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_chat_id TEXT UNIQUE,
  whatsapp_phone TEXT UNIQUE,
  display_name TEXT NOT NULL,
  niche TEXT,
  wallet_id TEXT,
  wallet_address TEXT,
  free_credits_remaining_cents INTEGER DEFAULT 1000,
  monthly_spend_cents INTEGER DEFAULT 0,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Platform connections table
CREATE TABLE platform_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  platform_user_id TEXT,
  platform_username TEXT,
  metadata JSONB DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(creator_id, platform)
);

-- Deals table
CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  brand_contact_email TEXT,
  brand_contact_name TEXT,
  stage TEXT NOT NULL DEFAULT 'discovered',
  fit_score INTEGER,
  estimated_value_cents INTEGER,
  actual_value_cents INTEGER,
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
CREATE TABLE transactions (
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

-- Agent actions table
CREATE TABLE agent_actions (
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table (for conversation history persistence)
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_creators_telegram_chat_id ON creators(telegram_chat_id);
CREATE INDEX idx_creators_whatsapp_phone ON creators(whatsapp_phone);
CREATE INDEX idx_deals_creator_id ON deals(creator_id);
CREATE INDEX idx_deals_stage ON deals(stage);
CREATE INDEX idx_transactions_creator_id ON transactions(creator_id);
CREATE INDEX idx_agent_actions_creator_id ON agent_actions(creator_id);
CREATE INDEX idx_agent_actions_status ON agent_actions(status);
CREATE INDEX idx_messages_creator_id ON messages(creator_id);

-- Enable Row Level Security on all tables
ALTER TABLE creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
