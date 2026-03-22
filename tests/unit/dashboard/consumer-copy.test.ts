import { describe, expect, it } from "vitest";

import {
  getDashboardShellCopy,
  getDashboardShellStatusCopy,
  getSignedOutCopy,
  getWalletPendingCopy,
} from "../../../dashboard/src/lib/consumer-copy";

describe("consumer dashboard copy", () => {
  it("uses creator-friendly shell language", () => {
    expect(getDashboardShellCopy()).toEqual({
      eyebrow: "Indyfren",
      title: "Your workspace",
      description:
        "Keep your deals, approvals, messages, and connected channels in one place.",
    });
  });

  it("keeps shell status language product-facing", () => {
    expect(
      getDashboardShellStatusCopy({
        stage: "active",
        creatorDisplayName: "Bolaji",
      })
    ).toBe("Signed in as Bolaji. Your creator workspace is ready.");
  });

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
