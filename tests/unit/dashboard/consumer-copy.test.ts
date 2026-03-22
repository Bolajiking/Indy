import { describe, expect, it } from "vitest";

import {
  getSignedOutCopy,
  getWalletPendingCopy,
} from "../../../dashboard/src/lib/consumer-copy";

describe("consumer dashboard copy", () => {
  it("avoids technical auth phrasing on the signed-out state", () => {
    expect(getSignedOutCopy()).toEqual({
      eyebrow: "Sign in required",
      title: "Sign in to open your workspace",
      detail: "Use Privy to access your deals, messages, wallet activity, and approvals.",
      actionLabel: "Sign in with Privy",
    });
  });

  it("keeps wallet pending language calm and action-oriented", () => {
    expect(
      getWalletPendingCopy({
        inProgress: true,
        lastError: null,
      }).detail
    ).toContain("background");
  });
});
