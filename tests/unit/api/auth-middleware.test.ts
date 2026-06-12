import { describe, expect, it } from "vitest";
import { getRequiredCreatorId } from "../../../src/api/middleware/auth.js";

describe("auth middleware helpers", () => {
  it("returns the authenticated creator id when present", () => {
    expect(
      getRequiredCreatorId({
        get: () => ({
          accessToken: "token",
          creatorId: "creator-1",
          privyUserId: "did:privy:user-1",
        }),
      }),
    ).toBe("creator-1");
  });

  it("throws the route-level creator registration error when absent", () => {
    expect(() =>
      getRequiredCreatorId({
        get: () => ({
          accessToken: "token",
          creatorId: null,
          privyUserId: "did:privy:user-1",
        }),
      }),
    ).toThrow("Creator profile not registered");
  });
});
