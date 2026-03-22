import type { DashboardAuthStage } from "./auth-state";

export interface DashboardShellCopy {
  eyebrow: string;
  title: string;
  description: string;
}

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

export function getDashboardShellCopy(): DashboardShellCopy {
  return {
    eyebrow: "Indyfren",
    title: "Your workspace",
    description:
      "Keep your deals, approvals, messages, and connected channels in one place.",
  };
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

export function getDashboardShellStatusCopy(input: {
  stage: DashboardAuthStage;
  creatorDisplayName?: string | null;
  walletProvisioningInProgress?: boolean;
  walletProvisioningLastError?: string | null;
}): string {
  switch (input.stage) {
    case "loading":
      return "Restoring your creator workspace.";
    case "signed_out":
      return getSignedOutCopy().detail;
    case "unregistered":
      return "You are signed in, but your creator profile still needs a quick setup before this workspace opens.";
    case "wallet_pending":
      return getWalletPendingCopy({
        inProgress: input.walletProvisioningInProgress ?? false,
        lastError: input.walletProvisioningLastError ?? null,
        creatorDisplayName: input.creatorDisplayName,
      }).detail;
    case "active":
      return input.creatorDisplayName?.trim()
        ? `Signed in as ${input.creatorDisplayName.trim()}. Your creator workspace is ready.`
        : "You're signed in. Your creator workspace is ready.";
  }
}
