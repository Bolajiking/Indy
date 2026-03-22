"use client";

import { useState } from "react";

import { DebugAccessTokenPanel } from "@/components/debug-access-token-panel";
import { shouldShowDebugAccessTokenPanel } from "@/lib/debug-auth";
import {
  getRegistrationErrorCopy,
  isCreatorServiceOutage,
} from "@/lib/onboarding-errors";
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

function RegistrationForm() {
  const { register, syncing, error, user, accessToken, authenticated, stage } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [niche, setNiche] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const surfacedError = getRegistrationErrorCopy(localError ?? error);
  const retryingAfterServiceOutage = isCreatorServiceOutage(error);
  const showDebugAccessTokenPanel = shouldShowDebugAccessTokenPanel({
    nodeEnv: process.env.NODE_ENV,
    authenticated,
    stage,
    accessToken,
  });

  return (
    <div className="space-y-6">
      <div
        className="space-y-6"
        style={{
          borderRadius: "var(--radius-hero)",
          border: "1px solid var(--border-default)",
          background: "var(--bg-canvas)",
          padding: 24,
        }}
      >
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)" }}>
            Almost there
          </p>
          <h3
            style={{
              fontSize: 24,
              fontWeight: 700,
              marginTop: 8,
              color: "var(--text-primary)",
            }}
          >
            Create your profile
          </h3>
          <p
            className="mt-4 max-w-2xl text-sm leading-7"
            style={{ color: "var(--text-tertiary)" }}
          >
            You&apos;re signed in{user ? ` as ${user.id}` : ""}. Add your creator name
            and optional niche so Indyfren can start working for you.
          </p>
        </div>

        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            setLocalError(null);

            if (!displayName.trim()) {
              setLocalError("Add a creator display name before continuing.");
              return;
            }

            void register({
              displayName: displayName.trim(),
              niche: niche.trim() || undefined,
            }).catch(() => {
              // Context already stores the surfaced error.
            });
          }}
        >
          <label className="space-y-2">
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-tertiary)" }}>
              Display name
            </span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              disabled={syncing}
              placeholder="Creator name or brand"
              className="w-full px-4 py-3 text-sm outline-none transition focus:border-[var(--border-focus)]"
              style={{
                borderRadius: "var(--radius-input)",
                border: "1.5px solid var(--border-light)",
                background: "var(--bg-input)",
                color: "var(--text-primary)",
              }}
            />
          </label>

          <label className="space-y-2">
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-tertiary)" }}>
              Niche
            </span>
            <input
              value={niche}
              onChange={(event) => setNiche(event.target.value)}
              disabled={syncing}
              placeholder="Finance, beauty, gaming..."
              className="w-full px-4 py-3 text-sm outline-none transition focus:border-[var(--border-focus)]"
              style={{
                borderRadius: "var(--radius-input)",
                border: "1.5px solid var(--border-light)",
                background: "var(--bg-input)",
                color: "var(--text-primary)",
              }}
            />
          </label>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={syncing}
              className="transition hover:opacity-90 disabled:opacity-50"
              style={{
                background: "var(--accent-blue)",
                color: "white",
                borderRadius: "var(--radius-button)",
                padding: "10px 24px",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {syncing
                ? "Creating profile..."
                : retryingAfterServiceOutage
                  ? "Retry profile creation"
                  : "Create profile"}
            </button>
          </div>
        </form>

        {surfacedError ? (
          <p
            className="px-4 py-3 text-sm"
            style={{
              border: "1px solid var(--accent-pink-border)",
              background: "var(--accent-pink-subtle)",
              color: "var(--text-primary)",
              borderRadius: "var(--radius-input)",
            }}
          >
            {surfacedError}
          </p>
        ) : null}
      </div>

      {showDebugAccessTokenPanel && accessToken ? (
        <DebugAccessTokenPanel accessToken={accessToken} />
      ) : null}
    </div>
  );
}

export function DashboardAuthGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { stage, login, refreshProfile, retryWalletProvisioning, onboarding } = useAuth();

const walletPendingDetail = onboarding.walletProvisioningInProgress
    ? "Wallet setup is running in the background. You can keep using the app while that finishes."
    : onboarding.walletProvisioningLastError
      ? `Your profile is ready, but wallet setup hit a snag: ${onboarding.walletProvisioningLastError}. Retry when you're ready.`
      : "Your profile is ready and the workspace is available. Wallet setup is still finishing up — paid actions will unlock once that completes.";

  if (stage === "loading") {
    return (
      <StateCard
        eyebrow="Loading"
        title="Opening your workspace."
        detail="Restoring your session so we can show your deals, messages, and approvals."
      />
    );
  }

  if (stage === "signed_out") {
    return (
      <StateCard
        eyebrow="Sign in required"
        title="Sign in to open your workspace"
        detail="Sign in with Privy to access your deals, messages, wallet activity, and approvals."
        actionLabel="Sign in with Privy"
        onAction={login}
      />
    );
  }

  if (stage === "unregistered") {
    return <RegistrationForm />;
  }

  return (
    <div className="space-y-6">
      {stage === "wallet_pending" ? (
        <StateCard
          eyebrow="Wallet setup"
          title="Your profile is ready — wallet is finishing up"
          detail={walletPendingDetail}
          actionLabel={
            onboarding.walletProvisioningInProgress
              ? "Refresh status"
              : "Retry wallet setup"
          }
          onAction={
            onboarding.walletProvisioningInProgress
              ? refreshProfile
              : retryWalletProvisioning
          }
          secondaryLabel="Refresh status"
          onSecondaryAction={refreshProfile}
          tone="ink"
        />
      ) : null}

      {children}
    </div>
  );
}
