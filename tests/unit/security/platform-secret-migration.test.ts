import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/db/client.js", () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from "../../../src/db/client.js";
import { migrateLegacyPlatformSecrets } from "../../../src/security/platform-secret-migration.js";

const key = Buffer.alloc(32, 9).toString("base64");

function mockRows(
  rows: Array<{
    id: string;
    access_token: string | null;
    refresh_token: string | null;
    key_version: number;
  }>,
  updateErrors: Record<string, Error> = {},
) {
  const limit = vi.fn().mockResolvedValue({ data: rows, error: null });
  const order = vi.fn().mockReturnValue({ limit });
  const gt = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ order, gt });
  const eq = vi.fn().mockImplementation(async (_field: string, id: string) => ({
    error: updateErrors[id] ?? null,
  }));
  const update = vi.fn().mockReturnValue({ eq });
  vi.mocked(supabase.from).mockReturnValue({ select, update } as never);
  return { select, order, limit, gt, update, eq };
}

describe("migrateLegacyPlatformSecrets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PLATFORM_ENCRYPTION_KEY_VERSION = "2";
    process.env.PLATFORM_ENCRYPTION_KEY_CURRENT = key;
  });

  it("rotates a bounded batch and persists its key version", async () => {
    const mocks = mockRows([
      {
        id: "conn-1",
        access_token: "plain-access",
        refresh_token: "plain-refresh",
        key_version: 1,
      },
      {
        id: "conn-2",
        access_token: "plain-access-2",
        refresh_token: null,
        key_version: 1,
      },
    ]);
    const result = await migrateLegacyPlatformSecrets({ batchSize: 2 });

    expect(mocks.limit).toHaveBeenCalledWith(2);
    expect(mocks.update).toHaveBeenCalledTimes(2);
    expect(mocks.update).toHaveBeenCalledWith({
      access_token: expect.stringMatching(/^v2:2:/),
      refresh_token: expect.stringMatching(/^v2:2:/),
      key_version: 2,
    });
    expect(result).toEqual({
      scanned: 2,
      rotated: 2,
      skipped: 0,
      failed: 0,
      dryRun: false,
      nextCursor: "conn-2",
      complete: false,
    });
  });

  it("resumes after a cursor and skips current rows", async () => {
    const { encryptSecretValue } =
      await import("../../../src/security/secrets.js");
    const current = encryptSecretValue("token");
    const mocks = mockRows([
      {
        id: "conn-3",
        access_token: current,
        refresh_token: null,
        key_version: 2,
      },
    ]);
    const result = await migrateLegacyPlatformSecrets({
      afterId: "conn-2",
      batchSize: 10,
    });
    expect(mocks.gt).toHaveBeenCalledWith("id", "conn-2");
    expect(mocks.update).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
    expect(result.complete).toBe(true);
  });

  it("dry-runs without writes and reports per-row failures without exposing values", async () => {
    const mocks = mockRows([
      {
        id: "good",
        access_token: "plain-secret",
        refresh_token: null,
        key_version: 1,
      },
      {
        id: "bad",
        access_token: "v2:99:abc:def:ghi",
        refresh_token: null,
        key_version: 99,
      },
    ]);
    const result = await migrateLegacyPlatformSecrets({
      dryRun: true,
      batchSize: 10,
    });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(result.rotated).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.complete).toBe(false);
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("continues after an update failure and counts it", async () => {
    const mocks = mockRows(
      [
        {
          id: "bad-write",
          access_token: "one",
          refresh_token: null,
          key_version: 1,
        },
        {
          id: "good-write",
          access_token: "two",
          refresh_token: null,
          key_version: 1,
        },
      ],
      { "bad-write": new Error("database unavailable") },
    );
    const result = await migrateLegacyPlatformSecrets({ batchSize: 10 });
    expect(mocks.update).toHaveBeenCalledTimes(2);
    expect(result.rotated).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.complete).toBe(false);
    expect(result.nextCursor).toBeNull();
  });
});
