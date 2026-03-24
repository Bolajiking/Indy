import { describe, expect, it } from "vitest";

import {
  canAccessCreatorData,
  getSyncFailureFallback,
  resolveDashboardAuthStage,
  shouldSyncDashboardSession,
  type DashboardOnboardingState,
} from "../../../dashboard/src/lib/auth-state";

function onboarding(
  overrides: Partial<DashboardOnboardingState> = {}
): DashboardOnboardingState {
  return {
    status: "unregistered",
    walletProvisioned: false,
    ...overrides,
  };
}

describe("resolveDashboardAuthStage", () => {
  it("returns loading until Privy is ready", () => {
    expect(
      resolveDashboardAuthStage({
        ready: false,
        authenticated: false,
        creator: null,
        onboarding: onboarding(),
      })
    ).toBe("loading");
  });

  it("returns signed_out when Privy is ready but no user is authenticated", () => {
    expect(
      resolveDashboardAuthStage({
        ready: true,
        authenticated: false,
        creator: null,
        onboarding: onboarding(),
      })
    ).toBe("signed_out");
  });

  it("returns unregistered for authenticated users without a creator profile", () => {
    expect(
      resolveDashboardAuthStage({
        ready: true,
        authenticated: true,
        creator: null,
        onboarding: onboarding({ status: "unregistered" }),
      })
    ).toBe("unregistered");
  });

  it("returns wallet_pending when a creator exists but onboarding is incomplete", () => {
    expect(
      resolveDashboardAuthStage({
        ready: true,
        authenticated: true,
        creator: { id: "creator-1" },
        onboarding: onboarding({ status: "wallet_pending" }),
      })
    ).toBe("wallet_pending");
  });

  it("returns active when onboarding is complete", () => {
    expect(
      resolveDashboardAuthStage({
        ready: true,
        authenticated: true,
        creator: { id: "creator-1" },
        onboarding: onboarding({ status: "active", walletProvisioned: true }),
      })
    ).toBe("active");
  });
});

describe("canAccessCreatorData", () => {
  it("allows data access only once a creator profile exists", () => {
    expect(canAccessCreatorData("loading")).toBe(false);
    expect(canAccessCreatorData("signed_out")).toBe(false);
    expect(canAccessCreatorData("unregistered")).toBe(false);
    expect(canAccessCreatorData("wallet_pending")).toBe(true);
    expect(canAccessCreatorData("active")).toBe(true);
  });
});

describe("getSyncFailureFallback", () => {
  it("preserves an existing creator profile during transient sync failures", () => {
    expect(
      getSyncFailureFallback({
        creator: { id: "creator-1", privy_user_id: "did:privy:user-1" },
        onboarding: onboarding({ status: "active", walletProvisioned: true }),
        currentUserId: "did:privy:user-1",
      })
    ).toEqual({
      creator: { id: "creator-1", privy_user_id: "did:privy:user-1" },
      onboarding: onboarding({ status: "active", walletProvisioned: true }),
    });
  });

  it("falls back to unregistered only when no creator profile was loaded yet", () => {
    expect(
      getSyncFailureFallback({
        creator: null,
        onboarding: onboarding({ status: "active", walletProvisioned: true }),
        currentUserId: "did:privy:user-1",
      })
    ).toEqual({
      creator: null,
      onboarding: onboarding(),
    });
  });

  it("clears stale creator state when a different Privy user fails to sync", () => {
    expect(
      getSyncFailureFallback({
        creator: { id: "creator-1", privy_user_id: "did:privy:user-1" },
        onboarding: onboarding({ status: "active", walletProvisioned: true }),
        currentUserId: "did:privy:user-2",
      })
    ).toEqual({
      creator: null,
      onboarding: onboarding(),
    });
  });
});

describe("shouldSyncDashboardSession", () => {
  it("syncs once for a newly authenticated user", () => {
    expect(
      shouldSyncDashboardSession({
        ready: true,
        authenticated: true,
        userId: "did:privy:user-1",
        lastSyncedUserId: null,
      })
    ).toBe(true);
  });

  it("does not re-sync repeatedly for the same user once already synced", () => {
    expect(
      shouldSyncDashboardSession({
        ready: true,
        authenticated: true,
        userId: "did:privy:user-1",
        lastSyncedUserId: "did:privy:user-1",
      })
    ).toBe(false);
  });

  it("does not sync when the dashboard is not ready or the user is signed out", () => {
    expect(
      shouldSyncDashboardSession({
        ready: false,
        authenticated: true,
        userId: "did:privy:user-1",
        lastSyncedUserId: null,
      })
    ).toBe(false);

    expect(
      shouldSyncDashboardSession({
        ready: true,
        authenticated: false,
        userId: "did:privy:user-1",
        lastSyncedUserId: null,
      })
    ).toBe(false);
  });
});
