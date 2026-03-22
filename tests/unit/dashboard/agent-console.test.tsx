// @vitest-environment jsdom

import React, { act } from "../../../dashboard/node_modules/react";
import { createRoot } from "../../../dashboard/node_modules/react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../dashboard/src/lib/api", async () => {
  const actual = await vi.importActual<typeof import("../../../dashboard/src/lib/api")>(
    "../../../dashboard/src/lib/api"
  );

  return {
    ...actual,
    approveAgentAction: vi.fn(),
    fetchAgentState: vi.fn(),
    sendAgentMessage: vi.fn(),
    skipAgentAction: vi.fn(),
  };
});

vi.mock("../../../dashboard/src/lib/privy", () => ({
  useAuth: vi.fn(() => ({
    accessToken: "access-token",
    creator: { display_name: "Bolaji" },
    onboarding: { walletProvisioned: true },
    stage: "active",
  })),
}));

import { fetchAgentState } from "../../../dashboard/src/lib/api";
import { AgentConsole } from "../../../dashboard/src/components/agent-console";

const PREFETCHED_STATE = {
  messages: [
    {
      id: "msg-prefetched",
      creator_id: "creator-1",
      role: "assistant",
      content: "Prefetched thread",
      metadata: { platform: "dashboard" },
      created_at: "2026-03-21T08:30:00.000Z",
    },
  ],
  pendingApprovals: [],
};

const FETCHED_STATE = {
  messages: [
    {
      id: "msg-fetched",
      creator_id: "creator-1",
      role: "assistant",
      content: "Fetched thread",
      metadata: { platform: "dashboard" },
      created_at: "2026-03-21T09:30:00.000Z",
    },
  ],
  pendingApprovals: [],
};

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("AgentConsole hydration", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("does not perform an extra initial fetch when hydrated with prefetched state", async () => {
    vi.mocked(fetchAgentState).mockResolvedValue(FETCHED_STATE);

    await act(async () => {
      root.render(
        React.createElement(AgentConsole, {
          initialState: PREFETCHED_STATE,
          isHydrated: true,
        })
      );
    });

    await flushEffects();

    expect(fetchAgentState).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Prefetched thread");
  });

  it("fetches for itself on mount when no hydrated prefetched state is provided", async () => {
    vi.mocked(fetchAgentState).mockResolvedValue(FETCHED_STATE);

    await act(async () => {
      root.render(React.createElement(AgentConsole));
    });

    await flushEffects();

    expect(fetchAgentState).toHaveBeenCalledTimes(1);
    expect(fetchAgentState).toHaveBeenCalledWith("access-token");
    expect(container.textContent).toContain("Fetched thread");
  });

  it("keeps the last known thread visible when a refresh fails", async () => {
    vi.mocked(fetchAgentState).mockRejectedValue(new Error("Request failed"));

    await act(async () => {
      root.render(
        React.createElement(AgentConsole, {
          initialState: PREFETCHED_STATE,
          isHydrated: true,
        })
      );
    });

    await flushEffects();

    const refreshButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Refresh thread")
    );

    expect(refreshButton).toBeTruthy();

    await act(async () => {
      refreshButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await flushEffects();

    expect(fetchAgentState).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Prefetched thread");
    expect(container.textContent).toContain("Request failed");
  });
});
