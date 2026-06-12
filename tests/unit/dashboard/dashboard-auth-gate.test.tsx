// @vitest-environment jsdom

import React from "react";
import { act } from "../../../dashboard/node_modules/react";
import { describe, expect, it, vi } from "vitest";
import { render } from "./test-helpers";

const useAuthMock = vi.fn();

vi.mock("../../../dashboard/src/lib/auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("../../../dashboard/src/components/onboarding-wizard", () => ({
  OnboardingWizard: () => React.createElement("div", null, "Onboarding"),
}));

import { DashboardAuthGate } from "../../../dashboard/src/components/dashboard-auth-gate";

describe("DashboardAuthGate", () => {
  function renderGate(authOverrides = {}) {
    const login = vi.fn();
    useAuthMock.mockReturnValue({
      stage: "signed_out",
      login,
      refreshProfile: vi.fn(),
      retryWalletProvisioning: vi.fn(),
      onboarding: { status: "unregistered", walletProvisioned: false },
      accessToken: null,
      authenticated: false,
      error: null,
      ...authOverrides,
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const { unmount } = render(
      React.createElement(
        DashboardAuthGate,
        null,
        React.createElement("div", null, "Dashboard"),
      ),
      container,
    );

    return { container, login, unmount };
  }

  it("opens Privy login when the signed-out action is clicked", () => {
    const { container, login, unmount } = renderGate();
    const button = container.querySelector("button");

    expect(button?.textContent).toBe("Sign in");

    act(() => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(login).toHaveBeenCalledTimes(1);
    unmount();
    container.remove();
  });

  it("shows auth configuration errors on the signed-out state", () => {
    const { container, unmount } = renderGate({
      error:
        "Dashboard auth is not configured yet. Add PRIVY_APP_ID or NEXT_PUBLIC_PRIVY_APP_ID to the workspace env.",
    });

    expect(container.textContent).toContain(
      "Dashboard auth is not configured yet",
    );

    unmount();
    container.remove();
  });

  it("keeps sign-in actionable when Privy is still loading", () => {
    const { container, login, unmount } = renderGate({
      stage: "loading",
      error: "Privy is still initializing.",
    });
    const button = container.querySelector("button");

    expect(container.textContent).toContain("Privy is still initializing.");
    expect(button?.textContent).toBe("Sign in");

    act(() => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(login).toHaveBeenCalledTimes(1);
    unmount();
    container.remove();
  });

  it("opens Privy automatically for dashboard login handoff links", async () => {
    window.history.pushState({}, "", "/dashboard?login=1&q=test");
    const { login, unmount } = renderGate();

    await act(async () => {});

    expect(login).toHaveBeenCalledTimes(1);
    expect(window.location.search).toBe("?q=test");

    unmount();
    window.history.pushState({}, "", "/");
  });
});
