"use client";

import { DebugAccessTokenPanel } from "@/components/debug-access-token-panel";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { shouldShowDebugAccessTokenPanel } from "@/lib/debug-auth";
import { useAuth } from "@/lib/privy";

function StateCard({
  eyebrow,
  title,
  detail,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondaryAction,
  tone = "paper",
}: {
  eyebrow: string;
  title: string;
  detail: string;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
  secondaryLabel?: string;
  onSecondaryAction?: () => void | Promise<void>;
  tone?: "paper" | "ink";
}) {
  const dark = tone === "ink";

  return (
    <div
      style={{
        borderRadius: "var(--radius-hero)",
        border: "1px solid var(--border-default)",
        padding: 24,
        ...(dark
          ? { background: "var(--gradient-approval)", color: "white" }
          : { background: "var(--bg-canvas)", color: "var(--text-primary)" }),
      }}
    >
      <p
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: dark ? "rgba(255,255,255,0.5)" : "var(--text-tertiary)",
        }}
      >
        {eyebrow}
      </p>
      <h3 style={{ fontSize: 24, fontWeight: 700, marginTop: 8 }}>{title}</h3>
      <p
        className="mt-4 max-w-2xl text-sm leading-7"
        style={{
          color: dark ? "rgba(255,255,255,0.72)" : "var(--text-tertiary)",
        }}
      >
        {detail}
      </p>

      {actionLabel || secondaryLabel ? (
        <div className="mt-6 flex flex-wrap gap-3">
          {actionLabel ? (
            <button
              onClick={() => {
                void onAction?.();
              }}
              className="transition hover:opacity-90"
              style={{
                background: "var(--accent-blue)",
                color: "white",
                borderRadius: "var(--radius-button)",
                padding: "10px 20px",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {actionLabel}
            </button>
          ) : null}

          {secondaryLabel ? (
            <button
              onClick={() => {
                void onSecondaryAction?.();
              }}
              className="transition"
              style={
                dark
                  ? {
                      border: "1.5px solid rgba(255,255,255,0.2)",
                      background: "rgba(255,255,255,0.1)",
                      color: "white",
                      borderRadius: "var(--radius-button)",
                      padding: "10px 20px",
                      fontSize: 13,
                      fontWeight: 500,
                    }
                  : {
                      border: "1.5px solid var(--border-light)",
                      color: "var(--text-primary)",
                      borderRadius: "var(--radius-button)",
                      padding: "10px 20px",
                      fontSize: 13,
                      fontWeight: 500,
                    }
              }
            >
              {secondaryLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}


export function DashboardAuthGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { stage, login, refreshProfile, retryWalletProvisioning, onboarding, accessToken, authenticated } = useAuth();
  const showDebugAccessTokenPanel = shouldShowDebugAccessTokenPanel({
    nodeEnv: process.env.NODE_ENV,
    authenticated,
    stage,
    accessToken,
  });

const walletPendingDetail = onboarding.walletProvisioningInProgress
    ? "Your wallet is being set up in the background — this only takes a moment. You can explore the app while it finishes."
    : onboarding.walletProvisioningLastError
      ? "Your profile is ready, but wallet setup hit a snag. Hit retry and it'll try again automatically."
      : "Your profile is ready. Wallet setup is finishing up — paid actions like brand research and email outreach will unlock once complete.";

  if (stage === "loading") {
    return (
      <StateCard
        eyebrow="Loading"
        title="Opening your workspace…"
        detail="Just a moment while we restore your session."
      />
    );
  }

  if (stage === "signed_out") {
    return (
      <StateCard
        eyebrow="Sign in required"
        title="Sign in to open your dashboard"
        detail="Sign in to access your deals, messages, wallet, and approvals."
        actionLabel="Sign in"
        onAction={login}
      />
    );
  }

  if (stage === "unregistered" || stage === "onboarding") {
    return (
      <div className="space-y-6">
        <OnboardingWizard />
        {showDebugAccessTokenPanel && accessToken ? (
          <DebugAccessTokenPanel accessToken={accessToken} />
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {stage === "wallet_pending" ? (
        <StateCard
          eyebrow="Almost ready"
          title="One last step — setting up your wallet"
          detail={walletPendingDetail}
          actionLabel={
            onboarding.walletProvisioningInProgress
              ? "Check status"
              : "Retry"
          }
          onAction={
            onboarding.walletProvisioningInProgress
              ? refreshProfile
              : retryWalletProvisioning
          }
          secondaryLabel="Refresh"
          onSecondaryAction={refreshProfile}
          tone="ink"
        />
      ) : null}

      {children}
    </div>
  );
}
