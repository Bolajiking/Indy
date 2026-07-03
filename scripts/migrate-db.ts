import "dotenv/config";

import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

export interface DatabaseClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: T[] }>;
}

export interface Migration {
  version: string;
  filename: string;
  sql: string;
  checksum: string;
}

export interface MigrationOptions {
  adoptBaseline?: boolean;
  checkOnly?: boolean;
}

const BASELINE_TABLES = [
  "creators",
  "platform_connections",
  "deals",
  "transactions",
  "payment_attempts",
  "agent_actions",
  "messages",
  "messaging_link_sessions",
  "creator_memories",
  "skill_outcomes",
] as const;

const BASELINE_COLUMNS: Record<(typeof BASELINE_TABLES)[number], string[]> = {
  creators: [
    "id",
    "privy_user_id",
    "telegram_chat_id",
    "whatsapp_phone",
    "display_name",
    "niche",
    "wallet_id",
    "wallet_address",
    "free_credits_remaining_cents",
    "monthly_spend_cents",
    "settings",
    "created_at",
    "updated_at",
  ],
  platform_connections: [
    "id",
    "creator_id",
    "platform",
    "access_token",
    "refresh_token",
    "platform_user_id",
    "platform_username",
    "metadata",
    "expires_at",
    "created_at",
  ],
  deals: [
    "id",
    "creator_id",
    "brand_name",
    "brand_contact_email",
    "brand_contact_name",
    "brand_domain",
    "stage",
    "fit_score",
    "estimated_value_cents",
    "actual_value_cents",
    "source_url",
    "source_type",
    "source_confidence",
    "source_evidence",
    "deliverables",
    "deadline_at",
    "follow_up_at",
    "probability",
    "next_action",
    "agent_provenance",
    "archived_at",
    "pitch_text",
    "pitch_sent_at",
    "response_text",
    "responded_at",
    "contract_notes",
    "notes",
    "metadata",
    "created_at",
    "updated_at",
  ],
  transactions: [
    "id",
    "creator_id",
    "type",
    "amount_cents",
    "currency",
    "description",
    "service",
    "tx_hash",
    "metadata",
    "created_at",
  ],
  payment_attempts: [
    "id",
    "creator_id",
    "transaction_id",
    "service_url",
    "service_host",
    "method",
    "intent",
    "currency",
    "quoted_amount_cents",
    "actual_amount_cents",
    "status",
    "challenge_id",
    "receipt_reference",
    "tx_hash",
    "error",
    "metadata",
    "created_at",
    "updated_at",
  ],
  agent_actions: [
    "id",
    "creator_id",
    "action_type",
    "status",
    "description",
    "input",
    "output",
    "cost_cents",
    "requires_approval",
    "approved_at",
    "executed_at",
    "created_at",
  ],
  messages: ["id", "creator_id", "role", "content", "metadata", "created_at"],
  messaging_link_sessions: [
    "id",
    "creator_id",
    "platform",
    "token_hash",
    "expires_at",
    "consumed_at",
    "consumed_by_platform_user_id",
    "created_at",
  ],
  creator_memories: [
    "id",
    "creator_id",
    "memory_type",
    "skill",
    "key",
    "content",
    "confidence",
    "times_reinforced",
    "last_used_at",
    "created_at",
    "updated_at",
  ],
  skill_outcomes: [
    "id",
    "creator_id",
    "skill",
    "action_id",
    "input_summary",
    "output_summary",
    "success",
    "creator_feedback",
    "creator_rating",
    "learnings",
    "created_at",
  ],
};

const BASELINE_INDEXES = [
  "idx_creators_telegram_chat_id",
  "idx_creators_whatsapp_phone",
  "idx_creators_privy_user_id",
  "idx_deals_creator_id",
  "idx_deals_stage",
  "idx_transactions_creator_id",
  "idx_payment_attempts_creator_id",
  "idx_payment_attempts_status",
  "idx_agent_actions_creator_id",
  "idx_agent_actions_status",
  "idx_messages_creator_id",
  "idx_messages_created_at",
  "idx_messaging_link_sessions_creator_id",
  "idx_messaging_link_sessions_expires_at",
  "idx_creator_memories_creator_id",
  "idx_creator_memories_skill",
  "idx_skill_outcomes_creator_skill",
  "idx_skill_outcomes_created_at",
] as const;

export const BASELINE_REQUIREMENTS: readonly string[] = [
  ...BASELINE_TABLES.map((table) => `table:${table}`),
  ...BASELINE_TABLES.flatMap((table) =>
    BASELINE_COLUMNS[table].map((column) => `column:${table}.${column}`),
  ),
  ...BASELINE_INDEXES.map((index) => `index:${index}`),
  ...BASELINE_TABLES.map((table) => `rls:${table}`),
  ...BASELINE_TABLES.flatMap((table) => [
    `policy:${table}.service_role_${table}`,
    `policy:${table}.deny_anon_${table}`,
  ]),
];

const LEDGER_SQL = `CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;

const BASELINE_INVENTORY_SQL = `
-- baseline_schema_inventory
SELECT 'table:' || c.relname AS name
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = current_schema() AND c.relkind = 'r'
UNION ALL
SELECT 'column:' || table_name || '.' || column_name
FROM information_schema.columns WHERE table_schema = current_schema()
UNION ALL
SELECT 'index:' || indexname FROM pg_indexes WHERE schemaname = current_schema()
UNION ALL
SELECT 'rls:' || c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = current_schema() AND c.relrowsecurity
UNION ALL
SELECT 'policy:' || tablename || '.' || policyname FROM pg_policies WHERE schemaname = current_schema()
`;

export async function discoverMigrations(
  directory: string,
): Promise<Migration[]> {
  const filenames = (await readdir(directory))
    .filter((filename) => filename.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right));
  const versions = new Set<string>();

  return Promise.all(
    filenames.map(async (filename) => {
      const match = /^(\d{4})_[a-z0-9_]+\.sql$/.exec(filename);
      if (!match) throw new Error(`Invalid migration filename: ${filename}`);
      const version = match[1];
      if (versions.has(version))
        throw new Error(`Duplicate migration version: ${version}`);
      versions.add(version);
      const sql = await readFile(resolve(directory, filename), "utf8");
      if (!sql.trim()) throw new Error(`Migration is empty: ${filename}`);
      return {
        version,
        filename,
        sql,
        checksum: createHash("sha256").update(sql).digest("hex"),
      };
    }),
  );
}

export async function verifyBaselineSchema(db: DatabaseClient): Promise<void> {
  const { rows } = await db.query<{ name: string }>(BASELINE_INVENTORY_SQL);
  const available = new Set(rows.map(({ name }) => name));
  const missing = BASELINE_REQUIREMENTS.filter((name) => !available.has(name));
  if (missing.length > 0) {
    throw new Error(
      `Baseline verification failed; missing: ${missing.join(", ")}`,
    );
  }
}

export async function runMigrations(
  db: DatabaseClient,
  migrations: readonly Migration[],
  options: MigrationOptions = {},
): Promise<{ applied: string[] }> {
  await db.query(LEDGER_SQL);
  const { rows } = await db.query<{ version: string; checksum: string }>(
    "SELECT version, checksum FROM schema_migrations ORDER BY version",
  );
  const recorded = new Map(rows.map((row) => [row.version, row.checksum]));

  for (const migration of migrations) {
    const checksum = recorded.get(migration.version);
    if (checksum !== undefined && checksum !== migration.checksum) {
      throw new Error(
        `Checksum drift detected for migration ${migration.version}`,
      );
    }
  }

  const pending = migrations.filter(({ version }) => !recorded.has(version));
  if (options.checkOnly) {
    if (pending.length > 0) {
      throw new Error(
        `Pending migrations: ${pending.map(({ version }) => version).join(", ")}`,
      );
    }
    return { applied: [] };
  }

  const applied: string[] = [];
  for (const migration of pending) {
    const adoptingBaseline =
      options.adoptBaseline && migration.version === "0001";

    await db.query("BEGIN");
    try {
      if (adoptingBaseline) await verifyBaselineSchema(db);
      else await db.query(migration.sql);
      await db.query(
        "INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)",
        [migration.version, migration.checksum],
      );
      await db.query("COMMIT");
      applied.push(migration.version);
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    }
  }
  return { applied };
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const args = new Set(process.argv.slice(2));
  const knownArgs = new Set(["--check", "--adopt-baseline"]);
  const unknown = [...args].filter((arg) => !knownArgs.has(arg));
  if (unknown.length > 0)
    throw new Error(`Unknown option: ${unknown.join(", ")}`);

  const migrationsDirectory = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../src/db/migrations",
  );
  const migrations = await discoverMigrations(migrationsDirectory);
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    const result = await runMigrations(client as DatabaseClient, migrations, {
      checkOnly: args.has("--check"),
      adoptBaseline: args.has("--adopt-baseline"),
    });
    console.log(
      result.applied.length > 0
        ? `Applied migrations: ${result.applied.join(", ")}`
        : "Database migrations are current.",
    );
  } finally {
    client.release();
    await pool.end();
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
