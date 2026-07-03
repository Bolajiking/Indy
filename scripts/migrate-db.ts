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

export interface CatalogObject extends Record<string, unknown> {
  kind: string;
  identity: string;
  definition: string;
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

type ColumnSpec = readonly [
  name: string,
  type: string,
  nullable?: boolean,
  defaultExpression?: string,
];

const BASELINE_COLUMNS: Record<
  (typeof BASELINE_TABLES)[number],
  readonly ColumnSpec[]
> = {
  creators: [
    ["id", "uuid", false, "gen_random_uuid()"],
    ["privy_user_id", "text"],
    ["telegram_chat_id", "text"],
    ["whatsapp_phone", "text"],
    ["display_name", "text", false],
    ["niche", "text"],
    ["wallet_id", "text"],
    ["wallet_address", "text"],
    ["free_credits_remaining_cents", "integer", true, "1000"],
    ["monthly_spend_cents", "integer", true, "0"],
    ["settings", "jsonb", true, "'{}'::jsonb"],
    ["created_at", "timestamp with time zone", true, "now()"],
    ["updated_at", "timestamp with time zone", true, "now()"],
  ],
  platform_connections: [
    ["id", "uuid", false, "gen_random_uuid()"],
    ["creator_id", "uuid", false],
    ["platform", "text", false],
    ["access_token", "text", false],
    ["refresh_token", "text"],
    ["platform_user_id", "text"],
    ["platform_username", "text"],
    ["metadata", "jsonb", true, "'{}'::jsonb"],
    ["expires_at", "timestamp with time zone"],
    ["created_at", "timestamp with time zone", true, "now()"],
  ],
  deals: [
    ["id", "uuid", false, "gen_random_uuid()"],
    ["creator_id", "uuid", false],
    ["brand_name", "text", false],
    ["brand_contact_email", "text"],
    ["brand_contact_name", "text"],
    ["brand_domain", "text"],
    ["stage", "text", false, "'discovered'::text"],
    ["fit_score", "integer"],
    ["estimated_value_cents", "integer"],
    ["actual_value_cents", "integer"],
    ["source_url", "text"],
    ["source_type", "text"],
    ["source_confidence", "integer"],
    ["source_evidence", "jsonb", true, "'[]'::jsonb"],
    ["deliverables", "jsonb", true, "'[]'::jsonb"],
    ["deadline_at", "timestamp with time zone"],
    ["follow_up_at", "timestamp with time zone"],
    ["probability", "integer"],
    ["next_action", "text"],
    ["agent_provenance", "jsonb", true, "'{}'::jsonb"],
    ["archived_at", "timestamp with time zone"],
    ["pitch_text", "text"],
    ["pitch_sent_at", "timestamp with time zone"],
    ["response_text", "text"],
    ["responded_at", "timestamp with time zone"],
    ["contract_notes", "text"],
    ["notes", "text"],
    ["metadata", "jsonb", true, "'{}'::jsonb"],
    ["created_at", "timestamp with time zone", true, "now()"],
    ["updated_at", "timestamp with time zone", true, "now()"],
  ],
  transactions: [
    ["id", "uuid", false, "gen_random_uuid()"],
    ["creator_id", "uuid", false],
    ["type", "text", false],
    ["amount_cents", "integer", false],
    ["currency", "text", true, "'USD'::text"],
    ["description", "text", false],
    ["service", "text"],
    ["tx_hash", "text"],
    ["metadata", "jsonb", true, "'{}'::jsonb"],
    ["created_at", "timestamp with time zone", true, "now()"],
  ],
  payment_attempts: [
    ["id", "uuid", false, "gen_random_uuid()"],
    ["creator_id", "uuid", false],
    ["transaction_id", "uuid"],
    ["service_url", "text", false],
    ["service_host", "text", false],
    ["method", "text"],
    ["intent", "text"],
    ["currency", "text"],
    ["quoted_amount_cents", "integer"],
    ["actual_amount_cents", "integer"],
    ["status", "text", false],
    ["challenge_id", "text"],
    ["receipt_reference", "text"],
    ["tx_hash", "text"],
    ["error", "text"],
    ["metadata", "jsonb", true, "'{}'::jsonb"],
    ["created_at", "timestamp with time zone", true, "now()"],
    ["updated_at", "timestamp with time zone", true, "now()"],
  ],
  agent_actions: [
    ["id", "uuid", false, "gen_random_uuid()"],
    ["creator_id", "uuid", false],
    ["action_type", "text", false],
    ["status", "text", false, "'pending'::text"],
    ["description", "text", false],
    ["input", "jsonb"],
    ["output", "jsonb"],
    ["cost_cents", "integer", true, "0"],
    ["requires_approval", "boolean", true, "false"],
    ["approved_at", "timestamp with time zone"],
    ["executed_at", "timestamp with time zone"],
    ["created_at", "timestamp with time zone", true, "now()"],
  ],
  messages: [
    ["id", "uuid", false, "gen_random_uuid()"],
    ["creator_id", "uuid", false],
    ["role", "text", false],
    ["content", "text", false],
    ["metadata", "jsonb", true, "'{}'::jsonb"],
    ["created_at", "timestamp with time zone", true, "now()"],
  ],
  messaging_link_sessions: [
    ["id", "uuid", false],
    ["creator_id", "uuid", false],
    ["platform", "text", false],
    ["token_hash", "text", false],
    ["expires_at", "timestamp with time zone", false],
    ["consumed_at", "timestamp with time zone"],
    ["consumed_by_platform_user_id", "text"],
    ["created_at", "timestamp with time zone", true, "now()"],
  ],
  creator_memories: [
    ["id", "uuid", false, "gen_random_uuid()"],
    ["creator_id", "uuid", false],
    ["memory_type", "text", false],
    ["skill", "text"],
    ["key", "text", false],
    ["content", "text", false],
    ["confidence", "real", true, "1.0"],
    ["times_reinforced", "integer", true, "1"],
    ["last_used_at", "timestamp with time zone", true, "now()"],
    ["created_at", "timestamp with time zone", true, "now()"],
    ["updated_at", "timestamp with time zone", true, "now()"],
  ],
  skill_outcomes: [
    ["id", "uuid", false, "gen_random_uuid()"],
    ["creator_id", "uuid", false],
    ["skill", "text", false],
    ["action_id", "uuid"],
    ["input_summary", "text"],
    ["output_summary", "text"],
    ["success", "boolean", false],
    ["creator_feedback", "text"],
    ["creator_rating", "integer"],
    ["learnings", "text"],
    ["created_at", "timestamp with time zone", true, "now()"],
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

const BASELINE_CONSTRAINTS: readonly (readonly [
  table: string,
  name: string,
  definition: string,
])[] = [
  ...BASELINE_TABLES.map(
    (table) => [table, `${table}_pkey`, "PRIMARY KEY (id)"] as const,
  ),
  ["creators", "creators_privy_user_id_key", "UNIQUE (privy_user_id)"],
  ["creators", "creators_telegram_chat_id_key", "UNIQUE (telegram_chat_id)"],
  ["creators", "creators_whatsapp_phone_key", "UNIQUE (whatsapp_phone)"],
  [
    "platform_connections",
    "platform_connections_creator_id_platform_key",
    "UNIQUE (creator_id, platform)",
  ],
  [
    "creator_memories",
    "creator_memories_creator_id_skill_key_key",
    "UNIQUE (creator_id, skill, key)",
  ],
  ...[
    "platform_connections",
    "deals",
    "transactions",
    "payment_attempts",
    "agent_actions",
    "messages",
    "messaging_link_sessions",
    "creator_memories",
    "skill_outcomes",
  ].map(
    (table) =>
      [
        table,
        `${table}_creator_id_fkey`,
        "FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE CASCADE",
      ] as const,
  ),
  [
    "payment_attempts",
    "payment_attempts_transaction_id_fkey",
    "FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL",
  ],
  [
    "skill_outcomes",
    "skill_outcomes_action_id_fkey",
    "FOREIGN KEY (action_id) REFERENCES agent_actions(id) ON DELETE SET NULL",
  ],
];

const INDEX_TABLES: Record<(typeof BASELINE_INDEXES)[number], string> = {
  idx_creators_telegram_chat_id: "creators(telegram_chat_id)",
  idx_creators_whatsapp_phone: "creators(whatsapp_phone)",
  idx_creators_privy_user_id: "creators(privy_user_id)",
  idx_deals_creator_id: "deals(creator_id)",
  idx_deals_stage: "deals(stage)",
  idx_transactions_creator_id: "transactions(creator_id)",
  idx_payment_attempts_creator_id: "payment_attempts(creator_id)",
  idx_payment_attempts_status: "payment_attempts(status)",
  idx_agent_actions_creator_id: "agent_actions(creator_id)",
  idx_agent_actions_status: "agent_actions(status)",
  idx_messages_creator_id: "messages(creator_id)",
  idx_messages_created_at: "messages(creator_id, created_at DESC)",
  idx_messaging_link_sessions_creator_id: "messaging_link_sessions(creator_id)",
  idx_messaging_link_sessions_expires_at: "messaging_link_sessions(expires_at)",
  idx_creator_memories_creator_id: "creator_memories(creator_id)",
  idx_creator_memories_skill: "creator_memories(creator_id, skill)",
  idx_skill_outcomes_creator_skill: "skill_outcomes(creator_id, skill)",
  idx_skill_outcomes_created_at: "skill_outcomes(created_at DESC)",
};

export const BASELINE_MANIFEST: readonly CatalogObject[] = [
  ...BASELINE_TABLES.map((table) => ({
    kind: "table",
    identity: table,
    definition: "present",
  })),
  ...BASELINE_TABLES.flatMap((table) =>
    BASELINE_COLUMNS[table].map(
      ([name, type, nullable = true, defaultExpression]) => ({
        kind: "column",
        identity: `${table}.${name}`,
        definition: `type=${type};nullable=${nullable};default=${defaultExpression ?? "<none>"}`,
      }),
    ),
  ),
  ...BASELINE_CONSTRAINTS.map(([table, name, definition]) => ({
    kind: "constraint",
    identity: `${table}.${name}`,
    definition,
  })),
  ...BASELINE_INDEXES.map((identity) => ({
    kind: "index",
    identity,
    definition: `CREATE INDEX ${identity} ON ${INDEX_TABLES[identity].replace("(", " USING btree (")}`,
  })),
  ...BASELINE_TABLES.map((table) => ({
    kind: "rls",
    identity: table,
    definition: "enabled=true",
  })),
  ...BASELINE_TABLES.flatMap((table) => [
    {
      kind: "policy",
      identity: `${table}.service_role_${table}`,
      definition: "permissive;all;{service_role};using=true;check=true",
    },
    {
      kind: "policy",
      identity: `${table}.deny_anon_${table}`,
      definition: "permissive;all;{anon};using=false;check=false",
    },
  ]),
];

const LEDGER_SQL = `CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;

// Stable session-level lock key for all Indy schema migration decisions.
export const MIGRATION_ADVISORY_LOCK_KEY = 1229866073;
const LOCK_SQL = "SELECT pg_advisory_lock($1)";
const UNLOCK_SQL = "SELECT pg_advisory_unlock($1)";
const LEDGER_EXISTS_SQL =
  "SELECT to_regclass(current_schema() || '.schema_migrations') AS ledger";

export const BASELINE_INVENTORY_SQL = `
-- baseline_schema_inventory
SELECT 'table'::text AS kind, c.relname::text AS identity, 'present'::text AS definition
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = current_schema() AND c.relkind = 'r'
UNION ALL
SELECT 'column', c.relname || '.' || a.attname,
  'type=' || format_type(a.atttypid, a.atttypmod) ||
  ';nullable=' || (NOT a.attnotnull)::text ||
  ';default=' || COALESCE(pg_get_expr(d.adbin, d.adrelid), '<none>')
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
WHERE n.nspname = current_schema() AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
UNION ALL
SELECT 'constraint', c.relname || '.' || con.conname, pg_get_constraintdef(con.oid, true)
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = current_schema() AND con.contype IN ('p', 'u', 'f', 'c')
UNION ALL
SELECT 'index', idx.relname, pg_get_indexdef(i.indexrelid, 0, true)
FROM pg_index i
JOIN pg_class idx ON idx.oid = i.indexrelid
JOIN pg_class tbl ON tbl.oid = i.indrelid
JOIN pg_namespace n ON n.oid = tbl.relnamespace
LEFT JOIN pg_constraint con ON con.conindid = i.indexrelid
WHERE n.nspname = current_schema() AND con.oid IS NULL
UNION ALL
SELECT 'rls', c.relname, 'enabled=' || c.relrowsecurity::text
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = current_schema() AND c.relrowsecurity
UNION ALL
SELECT 'policy', tablename || '.' || policyname,
  lower(permissive) || ';' || lower(cmd) || ';' || roles::text ||
  ';using=' || COALESCE(qual, '<none>') ||
  ';check=' || COALESCE(with_check, qual, '<none>')
FROM pg_policies WHERE schemaname = current_schema()
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

export function canonicalizeDefinition(definition: string): string {
  return definition.trim().replace(/'(?:''|[^'])*'|[^']+/g, (segment) => {
    if (segment.startsWith("'")) return segment;
    return segment
      .toLowerCase()
      .replace(/"public"\.|public\./gi, "")
      .replace(/"([a-z_][a-z0-9_]*)"/g, "$1")
      .replace(/\s+/g, " ")
      .replace(/\s*([(),=;])\s*/g, "$1");
  });
}

export function verifyBaselineInventory(
  inventory: readonly CatalogObject[],
): void {
  const actual = new Map<string, CatalogObject>();
  for (const object of inventory) {
    actual.set(`${object.kind}:${object.identity}`, object);
  }

  const problems: string[] = [];
  for (const expected of BASELINE_MANIFEST) {
    const key = `${expected.kind}:${expected.identity}`;
    const found = actual.get(key);
    if (!found) {
      problems.push(`missing ${expected.kind} ${expected.identity}`);
      continue;
    }
    if (
      canonicalizeDefinition(found.definition) !==
      canonicalizeDefinition(expected.definition)
    ) {
      problems.push(
        `${expected.kind} ${expected.identity} definition mismatch (expected ${canonicalizeDefinition(expected.definition)}, found ${canonicalizeDefinition(found.definition)})`,
      );
    }
  }
  const expectedPolicies = new Set(
    BASELINE_MANIFEST.filter(({ kind }) => kind === "policy").map(
      ({ identity }) => identity,
    ),
  );
  for (const object of inventory) {
    const [table] = object.identity.split(".");
    if (
      object.kind === "policy" &&
      BASELINE_TABLES.includes(table as (typeof BASELINE_TABLES)[number]) &&
      !expectedPolicies.has(object.identity)
    ) {
      problems.push(`unexpected policy ${object.identity}`);
    }
  }
  if (problems.length > 0) {
    throw new Error(`Baseline verification failed: ${problems.join("; ")}`);
  }
}

export async function verifyBaselineSchema(db: DatabaseClient): Promise<void> {
  const { rows } = await db.query<CatalogObject>(BASELINE_INVENTORY_SQL);
  verifyBaselineInventory(rows);
}

export async function runMigrations(
  db: DatabaseClient,
  migrations: readonly Migration[],
  options: MigrationOptions = {},
): Promise<{ applied: string[] }> {
  await db.query(LOCK_SQL, [MIGRATION_ADVISORY_LOCK_KEY]);
  let result: { applied: string[] } | undefined;
  let primaryError: unknown;
  try {
    result = await runMigrationsWithLock(db, migrations, options);
  } catch (error) {
    primaryError = error;
  }
  try {
    await db.query(UNLOCK_SQL, [MIGRATION_ADVISORY_LOCK_KEY]);
  } catch (unlockError) {
    if (primaryError !== undefined) {
      throw new AggregateError(
        [primaryError, unlockError],
        errorMessage(primaryError),
        { cause: primaryError },
      );
    }
    throw unlockError;
  }
  if (primaryError !== undefined) throw primaryError;
  return result!;
}

async function runMigrationsWithLock(
  db: DatabaseClient,
  migrations: readonly Migration[],
  options: MigrationOptions,
): Promise<{ applied: string[] }> {
  let rows: { version: string; checksum: string }[];
  if (options.checkOnly) {
    const existence = await db.query<{ ledger: string | null }>(
      LEDGER_EXISTS_SQL,
    );
    rows = existence.rows[0]?.ledger
      ? (
          await db.query<{ version: string; checksum: string }>(
            "SELECT version, checksum FROM schema_migrations ORDER BY version",
          )
        ).rows
      : [];
  } else {
    await db.query(LEDGER_SQL);
    rows = (
      await db.query<{ version: string; checksum: string }>(
        "SELECT version, checksum FROM schema_migrations ORDER BY version",
      )
    ).rows;
  }
  const recorded = new Map(rows.map((row) => [row.version, row.checksum]));
  const localVersions = new Set(migrations.map(({ version }) => version));
  const ahead = rows
    .map(({ version }) => version)
    .filter((version) => !localVersions.has(version));
  if (ahead.length > 0) {
    throw new Error(
      `Database is ahead of local migrations; unknown versions: ${ahead.join(", ")}`,
    );
  }

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
      try {
        await db.query("ROLLBACK");
      } catch (rollbackError) {
        throw new AggregateError([error, rollbackError], errorMessage(error), {
          cause: error,
        });
      }
      throw error;
    }
  }
  return { applied };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
