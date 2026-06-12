import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const { Client } = pg;

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  console.error("Missing DATABASE_URL. Cannot apply payment_attempts schema.");
  process.exit(1);
}

const needsSsl = !databaseUrl.includes("localhost");
const client = new Client({
  connectionString: databaseUrl,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
});

const sql = `
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

CREATE INDEX IF NOT EXISTS idx_payment_attempts_creator_id ON payment_attempts(creator_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_status ON payment_attempts(status);

ALTER TABLE payment_attempts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_payment_attempts') THEN
    CREATE POLICY service_role_payment_attempts ON payment_attempts FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'deny_anon_payment_attempts') THEN
    CREATE POLICY deny_anon_payment_attempts ON payment_attempts FOR ALL TO anon USING (false);
  END IF;
END $$;
`;

try {
  await client.connect();
  await client.query(sql);
  console.log("payment_attempts schema is ready.");
} finally {
  await client.end();
}
