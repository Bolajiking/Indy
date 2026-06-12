import { describe, expect, it } from "vitest";

import { resolvePublicEnvValue } from "../../../dashboard/next.config";

describe("dashboard next config env resolution", () => {
  it("falls back to the root Privy app id when the dashboard public value is empty", () => {
    expect(resolvePublicEnvValue("", "root-privy-app-id")).toBe(
      "root-privy-app-id",
    );
  });

  it("keeps the dashboard public value when it is present", () => {
    expect(resolvePublicEnvValue("dashboard-app-id", "root-privy-app-id")).toBe(
      "dashboard-app-id",
    );
  });
});
