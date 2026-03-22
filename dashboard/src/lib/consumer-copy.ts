import type { DashboardAuthStage } from "./auth-state";

export interface DashboardSignedOutCopy {
  eyebrow: string;
  title: string;
  detail: string;
  actionLabel: string;
}

export interface DashboardWalletPendingCopy {
  eyebrow: string;
  title: string;
  detail: string;
  actionLabel: string;
}

function formatAlmostReadyTitle(creatorDisplayName?: string | null): string {
  const trimmedName = creatorDisplayName?.trim();
  return trimmedName ? `${trimmedName} is almost ready` : "Your creator workspace is almost ready";
}

export function getSignedOutCopy(): DashboardSignedOutCopy {
  return {
    eyebrow: "Sign in required",
    title: "Sign in to open your workspace",
    detail: "Use Privy to access your deals, messages, wallet activity, and approvals.",
    actionLabel: "Sign in with Privy",
  };
}

export function getWalletPendingCopy(input: {
  inProgress: boolean;
  lastError: string | null;
  creatorDisplayName?: string | null;
}): DashboardWalletPendingCopy {
  if (input.inProgress) {
    return {
      eyebrow: "Wallet setup",
      title: formatAlmostReadyTitle(input.creatorDisplayName),
      detail:
        "Wallet setup is running in the background. You can keep working while Privy finishes provisioning.",
      actionLabel: "Refresh status",
    };
  }

  if (input.lastError) {
    return {
      eyebrow: "Wallet setup",
      title: "Wallet setup needs one more try",
      detail: `Your wallet setup hit a snag: ${input.lastError}. Retry when you're ready to continue.`,
      actionLabel: "Retry wallet setup",
    };
  }

  return {
    eyebrow: "Wallet setup",
    title: formatAlmostReadyTitle(input.creatorDisplayName),
    detail:
      "Your creator profile is ready, and wallet setup is still finishing up. The rest of the workspace stays available.",
    actionLabel: "Retry wallet setup",
  };
}
