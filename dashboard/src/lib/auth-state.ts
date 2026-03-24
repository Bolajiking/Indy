export interface DashboardOnboardingState {
  status: string;
  walletProvisioned: boolean;
  onboardingComplete?: boolean;
  walletProvisioningInProgress?: boolean;
  walletProvisioningLastError?: string | null;
}

export interface DashboardCreatorIdentity {
  id: string;
  privy_user_id?: string | null;
}

export type DashboardAuthStage =
  | "loading"
  | "signed_out"
  | "unregistered"
  | "onboarding"
  | "wallet_pending"
  | "active";

export function resolveDashboardAuthStage(input: {
  ready: boolean;
  authenticated: boolean;
  creator: DashboardCreatorIdentity | null;
  onboarding: DashboardOnboardingState;
}): DashboardAuthStage {
  if (!input.ready) {
    return "loading";
  }

  if (!input.authenticated) {
    return "signed_out";
  }

  if (!input.creator || input.onboarding.status === "unregistered") {
    return "unregistered";
  }

  if (input.onboarding.status === "active" || input.onboarding.walletProvisioned) {
    return "active";
  }

  if (input.onboarding.status === "wallet_pending") {
    return "wallet_pending";
  }

  if (!input.onboarding.onboardingComplete) {
    return "onboarding";
  }

  return "wallet_pending";
}

export function canAccessCreatorData(stage: DashboardAuthStage): boolean {
  return stage === "onboarding" || stage === "wallet_pending" || stage === "active";
}

export function getSyncFailureFallback<TCreator extends DashboardCreatorIdentity>(input: {
  creator: TCreator | null;
  onboarding: DashboardOnboardingState;
  currentUserId: string | null | undefined;
}): {
  creator: TCreator | null;
  onboarding: DashboardOnboardingState;
} {
  if (
    input.creator &&
    input.currentUserId &&
    input.creator.privy_user_id === input.currentUserId
  ) {
    return {
      creator: input.creator,
      onboarding: input.onboarding,
    };
  }

  return {
    creator: null,
    onboarding: {
      status: "unregistered",
      walletProvisioned: false,
    },
  };
}

export function shouldSyncDashboardSession(input: {
  ready: boolean;
  authenticated: boolean;
  userId: string | null | undefined;
  lastSyncedUserId: string | null;
}): boolean {
  if (!input.ready || !input.authenticated || !input.userId) {
    return false;
  }

  return input.userId !== input.lastSyncedUserId;
}
