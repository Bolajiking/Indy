import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/db/client.js", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from "../../../src/db/client.js";
import { migrateLegacyPlatformSecrets } from "../../../src/security/platform-secret-migration.js";

describe("migrateLegacyPlatformSecrets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("re-encrypts only legacy plaintext platform credentials", async () => {
    const select = vi.fn().mockResolvedValue({
      data: [
        {
          id: "conn-1",
          access_token: "plain-access",
          refresh_token: "plain-refresh",
        },
        {
          id: "conn-2",
          access_token: "v1:already-encrypted",
          refresh_token: null,
        },
      ],
      error: null,
    });
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table !== "platform_connections") {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        select,
        update,
      } as never;
    });

    const result = await migrateLegacyPlatformSecrets();

    expect(result).toEqual({
      scanned: 2,
      migrated: 1,
      skipped: 1,
      dryRun: false,
    });
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({
      access_token: expect.stringMatching(/^v1:/),
      refresh_token: expect.stringMatching(/^v1:/),
    });
    expect(eq).toHaveBeenCalledWith("id", "conn-1");
  });

  it("reports legacy rows without mutating them during dry runs", async () => {
    const select = vi.fn().mockResolvedValue({
      data: [
        {
          id: "conn-1",
          access_token: "plain-access",
          refresh_token: null,
        },
      ],
      error: null,
    });
    const update = vi.fn();

    vi.mocked(supabase.from).mockImplementation(() => {
      return {
        select,
        update,
      } as never;
    });

    const result = await migrateLegacyPlatformSecrets({ dryRun: true });

    expect(result).toEqual({
      scanned: 1,
      migrated: 1,
      skipped: 0,
      dryRun: true,
    });
    expect(update).not.toHaveBeenCalled();
  });
});
