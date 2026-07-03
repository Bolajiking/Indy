import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BASELINE_MANIFEST,
  BASELINE_INVENTORY_SQL,
  canonicalizeDefinition,
  discoverMigrations,
  runMigrations,
  verifyBaselineInventory,
  type CatalogObject,
  type DatabaseClient,
  type Migration,
} from "../../../scripts/migrate-db.js";

const migrationsDirectory = resolve(
  import.meta.dirname,
  "../../../src/db/migrations",
);

describe("database migration files", () => {
  it("discovers unique, lexically ordered, nonempty SQL migrations", async () => {
    const filenames = (await readdir(migrationsDirectory)).filter((filename) =>
      filename.endsWith(".sql"),
    );
    expect(filenames).toEqual([
      "0001_baseline.sql",
      "0002_public_launch_readiness.sql",
    ]);
    expect(new Set(filenames).size).toBe(filenames.length);
    expect(filenames).toEqual([...filenames].sort());
    for (const filename of filenames) {
      expect(
        (await readFile(resolve(migrationsDirectory, filename), "utf8")).trim(),
      ).not.toBe("");
    }
  });

  it("defines the public-launch schema additions and access controls", async () => {
    const sql = await readFile(
      resolve(migrationsDirectory, "0002_public_launch_readiness.sql"),
      "utf8",
    );
    expect(sql).toMatch(/CREATE TABLE webhook_events/i);
    expect(sql).toMatch(/provider_event_id TEXT NOT NULL/i);
    expect(sql).toMatch(/payload_hash TEXT NOT NULL/i);
    expect(sql).toMatch(/status TEXT NOT NULL DEFAULT 'queued'/i);
    expect(sql).toMatch(/attempt_count INTEGER NOT NULL DEFAULT 0/i);
    expect(sql).toMatch(/UNIQUE\s*\(provider, provider_event_id\)/i);
    expect(sql).toMatch(/agent_actions\s+ADD COLUMN expires_at/i);
    expect(sql).toMatch(/platform_connections\s+ADD COLUMN key_version/i);
    expect(sql).toMatch(/creators\s+ADD COLUMN account_status/i);
    expect(sql).toMatch(/creators\s+ADD COLUMN deletion_requested_at/i);
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/i);
    expect(sql).toMatch(/service_role_webhook_events/i);
    expect(sql).toMatch(/deny_anon_webhook_events/i);
  });

  it("keeps the clean-install snapshot and package commands in sync", async () => {
    const schema = await readFile(
      resolve(import.meta.dirname, "../../../src/db/schema.sql"),
      "utf8",
    );
    const packageJson = JSON.parse(
      await readFile(
        resolve(import.meta.dirname, "../../../package.json"),
        "utf8",
      ),
    ) as { scripts: Record<string, string> };
    expect(schema).toMatch(/ordered migrations.*clean-install snapshot/i);
    expect(schema).toMatch(/CREATE TABLE IF NOT EXISTS webhook_events/i);
    expect(schema).toMatch(/key_version INTEGER NOT NULL DEFAULT 1/i);
    expect(schema).toMatch(/account_status TEXT NOT NULL DEFAULT 'active'/i);
    expect(schema).toMatch(/deletion_requested_at TIMESTAMPTZ/i);
    expect(packageJson.scripts["db:migrate"]).toBe("tsx scripts/migrate-db.ts");
    expect(packageJson.scripts["db:migrate:check"]).toBe(
      "tsx scripts/migrate-db.ts --check",
    );
  });
});

describe("database migration runner", () => {
  it("executes the exact migration files in lexical order and records each transaction", async () => {
    const migrations = await discoverMigrations(migrationsDirectory);
    const db = new FakeDatabase();

    expect(await runMigrations(db, migrations)).toEqual({
      applied: ["0001", "0002"],
    });
    expect(db.transactionEvents).toEqual([
      "BEGIN",
      migrations[0].sql,
      "INSERT:0001",
      "COMMIT",
      "BEGIN",
      migrations[1].sql,
      "INSERT:0002",
      "COMMIT",
    ]);
  });

  it("rolls back an actual migration SQL failure without recording or committing it", async () => {
    const migrations = await discoverMigrations(migrationsDirectory);
    const db = new FakeDatabase({}, { failSql: migrations[1].sql });

    await expect(runMigrations(db, migrations)).rejects.toThrow(
      "migration failed",
    );
    expect(db.transactionEvents).toEqual([
      "BEGIN",
      migrations[0].sql,
      "INSERT:0001",
      "COMMIT",
      "BEGIN",
      migrations[1].sql,
      "ROLLBACK",
    ]);
    expect(db.applied.has("0002")).toBe(false);
  });

  it("does not execute actual migration SQL again on a second run", async () => {
    const migrations = await discoverMigrations(migrationsDirectory);
    const db = new FakeDatabase();
    await runMigrations(db, migrations);
    const firstEvents = [...db.transactionEvents];

    expect(await runMigrations(db, migrations)).toEqual({ applied: [] });
    expect(db.transactionEvents).toEqual(firstEvents);
  });

  it("rejects checksum drift before opening a transaction", async () => {
    const migrations = await discoverMigrations(migrationsDirectory);
    const db = new FakeDatabase({ "0001": "wrong-checksum" });
    await expect(runMigrations(db, migrations)).rejects.toThrow(
      /checksum drift.*0001/i,
    );
    expect(db.transactionEvents).toEqual([]);
  });

  it("adopts a definition-verified baseline then applies only the real launch SQL", async () => {
    const migrations = await discoverMigrations(migrationsDirectory);
    const db = new FakeDatabase({}, { catalog: catalogFromManifest() });

    expect(
      await runMigrations(db, migrations, { adoptBaseline: true }),
    ).toEqual({ applied: ["0001", "0002"] });
    expect(db.transactionEvents).toEqual([
      "BEGIN",
      "CATALOG",
      "INSERT:0001",
      "COMMIT",
      "BEGIN",
      migrations[1].sql,
      "INSERT:0002",
      "COMMIT",
    ]);
  });

  it("rolls back and refuses adoption when a catalog definition is unsafe", async () => {
    const migrations = await discoverMigrations(migrationsDirectory);
    const catalog = catalogFromManifest();
    replaceDefinition(
      catalog,
      "policy",
      "creators.deny_anon_creators",
      "permissive;all;{anon};using=true;check=true",
    );
    const db = new FakeDatabase({}, { catalog });

    await expect(
      runMigrations(db, migrations, { adoptBaseline: true }),
    ).rejects.toThrow(/policy creators\.deny_anon_creators.*mismatch/i);
    expect(db.transactionEvents).toEqual(["BEGIN", "CATALOG", "ROLLBACK"]);
    expect(db.applied.size).toBe(0);
  });

  it.each([
    ["PK", "creators.creators_pkey", "deals.creators_pkey", "missing"],
    [
      "FK",
      "deals.deals_creator_id_fkey",
      "transactions.deals_creator_id_fkey",
      "divergent",
    ],
    [
      "unique",
      "creators.creators_privy_user_id_key",
      "deals.creators_privy_user_id_key",
      "missing",
    ],
  ])(
    "does not let another table's same-named constraint satisfy a %s during adoption",
    async (_label, expectedIdentity, collidingIdentity, mode) => {
      const migrations = await discoverMigrations(migrationsDirectory);
      const catalog = catalogFromManifest();
      const expected = catalog.find(
        ({ kind, identity }) =>
          kind === "constraint" && identity === expectedIdentity,
      );
      if (!expected) throw new Error(`Missing fixture ${expectedIdentity}`);

      catalog.push({
        kind: "constraint",
        identity: collidingIdentity,
        definition: expected.definition,
      });
      if (mode === "missing") {
        catalog.splice(catalog.indexOf(expected), 1);
      } else {
        expected.definition = "CHECK (false)";
      }
      const db = new FakeDatabase({}, { catalog });

      await expect(
        runMigrations(db, migrations, { adoptBaseline: true }),
      ).rejects.toThrow(
        new RegExp(
          mode === "missing"
            ? `missing constraint ${escapeRegExp(expectedIdentity)}`
            : `constraint ${escapeRegExp(expectedIdentity)}.*mismatch`,
          "i",
        ),
      );
      expect(db.transactionEvents).toEqual(["BEGIN", "CATALOG", "ROLLBACK"]);
    },
  );
});

describe("baseline definition verification", () => {
  it("qualifies constraint identities with their owning table", () => {
    expect(
      BASELINE_MANIFEST.some(
        ({ kind, identity }) =>
          kind === "constraint" && identity === "creators.creators_pkey",
      ),
    ).toBe(true);
    expect(BASELINE_INVENTORY_SQL).toMatch(
      /c\.relname\s*\|\|\s*'\.'\s*\|\|\s*con\.conname/i,
    );
  });

  it("uses PostgreSQL catalog deparsers for definition-level inventory", () => {
    expect(BASELINE_INVENTORY_SQL).toMatch(/format_type\s*\(/i);
    expect(BASELINE_INVENTORY_SQL).toMatch(/pg_get_expr\s*\(/i);
    expect(BASELINE_INVENTORY_SQL).toMatch(/pg_get_constraintdef\s*\(/i);
    expect(BASELINE_INVENTORY_SQL).toMatch(/pg_get_indexdef\s*\(/i);
    expect(BASELINE_INVENTORY_SQL).toMatch(/relrowsecurity/i);
    expect(BASELINE_INVENTORY_SQL).toMatch(/roles::text/i);
    expect(BASELINE_INVENTORY_SQL).toMatch(/with_check/i);
  });

  it("does not canonicalize meaningful whitespace inside string literals", () => {
    expect(canonicalizeDefinition("default='a, b'")).not.toBe(
      canonicalizeDefinition("default='a,b'"),
    );
  });

  it.each([
    [
      "column type",
      "column",
      "creators.id",
      "type=text;nullable=false;default=gen_random_uuid()",
    ],
    [
      "column default",
      "column",
      "creators.free_credits_remaining_cents",
      "type=integer;nullable=true;default=999",
    ],
    [
      "case-sensitive text default",
      "column",
      "transactions.currency",
      "type=text;nullable=true;default='usd'::text",
    ],
    [
      "column nullability",
      "column",
      "creators.display_name",
      "type=text;nullable=true;default=<none>",
    ],
    [
      "index definition",
      "index",
      "idx_deals_creator_id",
      "create index idx_deals_creator_id on deals using btree (stage)",
    ],
    [
      "index uniqueness",
      "index",
      "idx_deals_creator_id",
      "create unique index idx_deals_creator_id on deals using btree (creator_id)",
    ],
    [
      "constraint definition",
      "constraint",
      "platform_connections.platform_connections_creator_id_fkey",
      "foreign key (creator_id) references creators(id)",
    ],
    ["RLS", "rls", "creators", "enabled=false"],
    [
      "policy roles",
      "policy",
      "creators.service_role_creators",
      "permissive;all;{anon};using=true;check=true",
    ],
    [
      "policy mode",
      "policy",
      "creators.service_role_creators",
      "restrictive;all;{service_role};using=true;check=true",
    ],
    [
      "policy command",
      "policy",
      "creators.service_role_creators",
      "permissive;select;{service_role};using=true;check=true",
    ],
    [
      "policy USING",
      "policy",
      "creators.deny_anon_creators",
      "permissive;all;{anon};using=true;check=false",
    ],
    [
      "policy WITH CHECK",
      "policy",
      "creators.deny_anon_creators",
      "permissive;all;{anon};using=false;check=true",
    ],
  ])("rejects a %s mismatch", (_label, kind, identity, definition) => {
    const catalog = catalogFromManifest();
    replaceDefinition(catalog, kind, identity, definition);
    expect(() => verifyBaselineInventory(catalog)).toThrow(
      new RegExp(`${kind} ${escapeRegExp(identity)}.*mismatch`, "i"),
    );
  });

  it("rejects missing tables and foreign keys", () => {
    for (const [kind, identity] of [
      ["table", "creators"],
      ["constraint", "deals.deals_creator_id_fkey"],
    ]) {
      const catalog = catalogFromManifest().filter(
        (object) => !(object.kind === kind && object.identity === identity),
      );
      expect(() => verifyBaselineInventory(catalog)).toThrow(
        new RegExp(`missing ${kind} ${identity}`, "i"),
      );
    }
  });
});

function catalogFromManifest(): CatalogObject[] {
  return BASELINE_MANIFEST.map((object) => ({ ...object }));
}

function replaceDefinition(
  catalog: CatalogObject[],
  kind: string,
  identity: string,
  definition: string,
): void {
  const object = catalog.find(
    (candidate) => candidate.kind === kind && candidate.identity === identity,
  );
  if (!object) throw new Error(`Missing test fixture ${kind} ${identity}`);
  object.definition = definition;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

class FakeDatabase implements DatabaseClient {
  readonly transactionEvents: string[] = [];
  readonly applied: Map<string, string>;
  private readonly failSql?: string;
  private readonly catalog: CatalogObject[];
  private stagedInsert?: [string, string];

  constructor(
    applied: Record<string, string> = {},
    options: { failSql?: string; catalog?: CatalogObject[] } = {},
  ) {
    this.applied = new Map(Object.entries(applied));
    this.failSql = options.failSql;
    this.catalog = options.catalog ?? [];
  }

  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<{ rows: T[] }> {
    if (text.includes("baseline_schema_inventory")) {
      this.transactionEvents.push("CATALOG");
      return { rows: this.catalog as T[] };
    }
    if (text.startsWith("SELECT version, checksum")) {
      return {
        rows: [...this.applied].map(([version, checksum]) => ({
          version,
          checksum,
        })) as T[],
      };
    }
    if (text === "BEGIN") {
      this.transactionEvents.push(text);
      return { rows: [] };
    }
    if (text === "COMMIT") {
      this.transactionEvents.push(text);
      if (this.stagedInsert) this.applied.set(...this.stagedInsert);
      this.stagedInsert = undefined;
      return { rows: [] };
    }
    if (text === "ROLLBACK") {
      this.transactionEvents.push(text);
      this.stagedInsert = undefined;
      return { rows: [] };
    }
    if (text.startsWith("INSERT INTO schema_migrations")) {
      const version = String(values[0]);
      this.transactionEvents.push(`INSERT:${version}`);
      this.stagedInsert = [version, String(values[1])];
      return { rows: [] };
    }
    if (text.startsWith("CREATE TABLE IF NOT EXISTS schema_migrations")) {
      return { rows: [] };
    }
    this.transactionEvents.push(text);
    if (text === this.failSql) throw new Error("migration failed");
    return { rows: [] };
  }
}
