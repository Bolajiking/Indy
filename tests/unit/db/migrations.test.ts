import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BASELINE_REQUIREMENTS,
  discoverMigrations,
  runMigrations,
  type DatabaseClient,
  type Migration,
} from "../../../scripts/migrate-db.js";

const migrationsDirectory = resolve(
  import.meta.dirname,
  "../../../src/db/migrations",
);

describe("database migrations", () => {
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
      const sql = await readFile(
        resolve(migrationsDirectory, filename),
        "utf8",
      );
      expect(sql.trim()).not.toBe("");
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
    expect(schema).toMatch(/expires_at TIMESTAMPTZ/);
    expect(schema).toMatch(/key_version INTEGER NOT NULL DEFAULT 1/i);
    expect(schema).toMatch(/account_status TEXT NOT NULL DEFAULT 'active'/i);
    expect(schema).toMatch(/deletion_requested_at TIMESTAMPTZ/i);
    expect(packageJson.scripts["db:migrate"]).toBe("tsx scripts/migrate-db.ts");
    expect(packageJson.scripts["db:migrate:check"]).toBe(
      "tsx scripts/migrate-db.ts --check",
    );
  });

  it("discovers migrations in deterministic order with checksums", async () => {
    const migrations = await discoverMigrations(migrationsDirectory);

    expect(migrations.map(({ version }) => version)).toEqual(["0001", "0002"]);
    expect(
      migrations.every(({ checksum }) => /^[a-f0-9]{64}$/.test(checksum)),
    ).toBe(true);
  });

  it("rejects checksum drift for an applied migration", async () => {
    const migrations = fixtureMigrations();
    const db = new FakeDatabase({ "0001": "not-the-current-checksum" });

    await expect(runMigrations(db, migrations)).rejects.toThrow(
      /checksum drift.*0001/i,
    );
    expect(db.commands).not.toContain("BEGIN");
  });

  it("rolls back a failed migration without recording it", async () => {
    const migrations = fixtureMigrations();
    const db = new FakeDatabase({}, { failSql: migrations[1].sql });

    await expect(runMigrations(db, migrations)).rejects.toThrow(
      "migration failed",
    );
    expect(db.commands).toEqual(
      expect.arrayContaining(["BEGIN", "COMMIT", "ROLLBACK"]),
    );
    expect(db.applied.has("0001")).toBe(true);
    expect(db.applied.has("0002")).toBe(false);
  });

  it("applies every migration to a clean database then becomes idempotent", async () => {
    const migrations = fixtureMigrations();
    const db = new FakeDatabase();

    expect(await runMigrations(db, migrations)).toEqual({
      applied: ["0001", "0002"],
    });
    const transactionCount = db.commands.filter(
      (sql) => sql === "BEGIN",
    ).length;

    expect(await runMigrations(db, migrations)).toEqual({ applied: [] });
    expect(db.commands.filter((sql) => sql === "BEGIN")).toHaveLength(
      transactionCount,
    );
  });

  it("adopts a verified baseline before applying later migrations", async () => {
    const migrations = fixtureMigrations();
    const db = new FakeDatabase({}, { baselineObjects: BASELINE_REQUIREMENTS });

    expect(
      await runMigrations(db, migrations, { adoptBaseline: true }),
    ).toEqual({ applied: ["0001", "0002"] });
    expect(db.executedMigrationSql).toEqual([migrations[1].sql]);
  });

  it("refuses to adopt an incomplete or unknown baseline", async () => {
    const migrations = fixtureMigrations();
    const db = new FakeDatabase(
      {},
      { baselineObjects: [BASELINE_REQUIREMENTS[0]] },
    );

    await expect(
      runMigrations(db, migrations, { adoptBaseline: true }),
    ).rejects.toThrow(/baseline verification failed/i);
    expect(db.applied.size).toBe(0);
    expect(db.commands).toEqual(expect.arrayContaining(["BEGIN", "ROLLBACK"]));
  });
});

function fixtureMigrations(): Migration[] {
  return [
    {
      version: "0001",
      filename: "0001_baseline.sql",
      sql: "BASELINE SQL",
      checksum: "aaa",
    },
    {
      version: "0002",
      filename: "0002_launch.sql",
      sql: "LAUNCH SQL",
      checksum: "bbb",
    },
  ];
}

class FakeDatabase implements DatabaseClient {
  readonly commands: string[] = [];
  readonly executedMigrationSql: string[] = [];
  readonly applied: Map<string, string>;
  private readonly failSql?: string;
  private readonly baselineObjects: readonly string[];

  constructor(
    applied: Record<string, string> = {},
    options: { failSql?: string; baselineObjects?: readonly string[] } = {},
  ) {
    this.applied = new Map(Object.entries(applied));
    this.failSql = options.failSql;
    this.baselineObjects = options.baselineObjects ?? [];
  }

  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<{ rows: T[] }> {
    this.commands.push(text);
    if (text.includes("baseline_schema_inventory")) {
      return {
        rows: this.baselineObjects.map((name) => ({ name })) as T[],
      };
    }
    if (text.startsWith("SELECT version, checksum")) {
      return {
        rows: [...this.applied].map(([version, checksum]) => ({
          version,
          checksum,
        })) as T[],
      };
    }
    if (text.startsWith("INSERT INTO schema_migrations")) {
      this.applied.set(String(values[0]), String(values[1]));
      return { rows: [] };
    }
    if (text === this.failSql) throw new Error("migration failed");
    if (text === "BASELINE SQL" || text === "LAUNCH SQL") {
      this.executedMigrationSql.push(text);
    }
    return { rows: [] };
  }
}
