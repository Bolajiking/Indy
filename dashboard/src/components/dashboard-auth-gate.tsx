"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { useAuth } from "@/lib/auth-context";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { Fren, Logo } from "@/components/cf/primitives";

function CenteredGlass({
  eyebrow,
  title,
  detail,
  actionLabel,
  onAction,
  pose,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
  pose?: string;
}) {
  return (
    <>
      <div className="float-tr">
        <div className="pill-btn" style={{ paddingRight: 18 }}>
          <Logo size={15} />
        </div>
      </div>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1,
          display: "grid",
          placeItems: "center",
          padding: 20,
        }}
      >
        <div
          className="glass rise"
          style={{
            width: "min(440px, 94vw)",
            padding: "40px 36px",
            textAlign: "center",
          }}
        >
          {pose && (
            <div
              style={{
                display: "grid",
                placeItems: "center",
                marginBottom: 18,
                height: 92,
              }}
            >
              <Fren
                pose={pose}
                size={96}
                color="rgb(var(--ink))"
                colorB="var(--cf-secondary)"
                sw={20}
              />
            </div>
          )}
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            {eyebrow}
          </div>
          <h1 className="h-title" style={{ marginBottom: 10 }}>
            {title}
          </h1>
          <p className="h-sub" style={{ maxWidth: 340, margin: "0 auto 26px" }}>
            {detail}
          </p>
          {actionLabel && (
            <button className="btn-primary" onClick={() => void onAction?.()}>
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

export function DashboardAuthGate({ children }: { children: ReactNode }) {
  const { stage, login, error } = useAuth();
  const handledLoginHintRef = useRef(false);

  useEffect(() => {
    if (
      handledLoginHintRef.current ||
      (stage !== "signed_out" && stage !== "loading")
    ) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("login") !== "1") {
      return;
    }

    handledLoginHintRef.current = true;
    params.delete("login");
    const nextSearch = params.toString();
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`,
    );
    void login();
  }, [login, stage]);

  if (stage === "loading") {
    return (
      <CenteredGlass
        eyebrow="Loading"
        title="Opening your workspace…"
        detail={error ?? "Just a moment while we restore your session."}
        actionLabel="Sign in"
        onAction={login}
        pose="reach"
      />
    );
  }

  if (stage === "signed_out") {
    return (
      <CenteredGlass
        eyebrow="Welcome to Indyfren"
        title="Sign in to open your workspace"
        detail={
          error ??
          "Access your deals, wallet, approvals, and your AI business manager."
        }
        actionLabel="Sign in"
        onAction={login}
        pose="squad"
      />
    );
  }

  if (stage === "unregistered" || stage === "onboarding") {
    return <OnboardingWizard />;
  }

  // wallet_pending + active — the app is usable; wallet status surfaces on the Wallet page.
  return <>{children}</>;
}
