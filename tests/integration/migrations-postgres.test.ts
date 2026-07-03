import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg, { type PoolClient } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  discoverMigrations,
  runMigrations,
  type Migration,
} from "../../scripts/migrate-db.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const integration = describe.skipIf(!testDatabaseUrl);

integration.sequential("database migrations on PostgreSQL", () => {
  let pool: pg.Pool;
  let client: PoolClient;
  let migrations: Migration[];
  let snapshotSql: string;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: testDatabaseUrl });
    client = await pool.connect();
    const { rows } = await client.query<{ database: string }>(
      "SELECT current_database() AS database",
    );
    const database = rows[0]?.database ?? "";
    if (!database.endsWith("_test")) {
      throw new Error(
        `Refusing migration integration reset: database ${database || "<unknown>"} is not a dedicated *_test database`,
      );
    }
    migrations = await discoverMigrations(
      resolve(import.meta.dirname, "../../src/db/migrations"),
    );
    snapshotSql = await readFile(
      resolve(import.meta.dirname, "../../src/db/schema.sql"),
      "utf8",
    );
  });

  beforeEach(async () => {
    await resetDedicatedTestSchema(client);
  });

  afterAll(async () => {
    client?.release();
    await pool?.end();
  });

  it("applies actual migrations cleanly, reruns idempotently, and checks current", async () => {
    expect(await runMigrations(client, migrations)).toEqual({
      applied: ["0001", "0002"],
    });
    expect(await runMigrations(client, migrations)).toEqual({ applied: [] });
    expect(
      await runMigrations(client, migrations, { checkOnly: true }),
    ).toEqual({ applied: [] });
  });

  it("hands a snapshot install to migration check and reruns idempotently", async () => {
    await client.query(snapshotSql);
    expect(
      await runMigrations(client, migrations, { checkOnly: true }),
    ).toEqual({ applied: [] });

    await client.query(snapshotSql);
    expect(
      await runMigrations(client, migrations, { checkOnly: true }),
    ).toEqual({ applied: [] });
  });

  it("surfaces snapshot ledger drift without repairing the checksum", async () => {
    await client.query(snapshotSql);
    await client.query(
      "UPDATE schema_migrations SET checksum = 'tampered' WHERE version = '0001'",
    );

    await expect(client.query(snapshotSql)).rejects.toThrow(
      /checksum drift.*0001/i,
    );
    const { rows } = await client.query<{ checksum: string }>(
      "SELECT checksum FROM schema_migrations WHERE version = '0001'",
    );
    expect(rows[0]?.checksum).toBe("tampered");
  });

  it("adopts an actual verified baseline and applies the launch migration", async () => {
    await client.query(migrations[0].sql);

    expect(
      await runMigrations(client, migrations, { adoptBaseline: true }),
    ).toEqual({ applied: ["0001", "0002"] });
  });

  it("rejects adoption when the baseline has an unexpected permissive policy", async () => {
    await client.query(migrations[0].sql);
    await client.query(
      "CREATE POLICY extra_anon_read ON creators FOR SELECT TO anon USING (true)",
    );

    await expect(
      runMigrations(client, migrations, { adoptBaseline: true }),
    ).rejects.toThrow(/unexpected policy creators\.extra_anon_read/i);
  });
});

async function resetDedicatedTestSchema(client: PoolClient): Promise<void> {
  await client.query("DROP SCHEMA public CASCADE");
  await client.query("CREATE SCHEMA public");
  await client.query(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      CREATE ROLE service_role;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      CREATE ROLE anon;
    END IF;
  END $$`);
}
