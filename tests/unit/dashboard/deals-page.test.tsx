// @vitest-environment jsdom

import React, { act } from "../../../dashboard/node_modules/react";
import { describe, expect, it, vi } from "vitest";
import { render } from "./test-helpers";

type MockLinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  children?: React.ReactNode;
  href: string;
};

vi.mock("../../../dashboard/node_modules/next/link", () => ({
  default: ({ children, href, ...props }: MockLinkProps) =>
    React.createElement("a", { href, ...props }, children),
}));

vi.mock("../../../dashboard/node_modules/next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("../../../dashboard/src/components/dashboard-auth-gate", () => ({
  DashboardAuthGate: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

vi.mock("../../../dashboard/src/lib/auth-context", () => ({
  useAuth: () => ({ accessToken: "access-token" }),
}));

vi.mock("../../../dashboard/src/lib/deals-sync", () => ({
  broadcastDealsChanged: vi.fn(),
  subscribeDealsChanged: vi.fn(() => () => {}),
}));

vi.mock("../../../dashboard/src/lib/use-authed-query", () => ({
  useAuthedQuery: vi.fn(),
}));

vi.mock("../../../dashboard/src/lib/api", async () => {
  const actual = await vi.importActual<
    typeof import("../../../dashboard/src/lib/api")
  >("../../../dashboard/src/lib/api");

  return {
    ...actual,
    approveAgentAction: vi.fn(),
    fetchAgentState: vi.fn(),
    fetchDeals: vi.fn(),
    patchDealStage: vi.fn(),
    skipAgentAction: vi.fn(),
  };
});

import DealsPage from "../../../dashboard/src/app/dashboard/deals/page";
import {
  fetchAgentState,
  fetchDeals,
  patchDealStage,
} from "../../../dashboard/src/lib/api";
import { useAuthedQuery } from "../../../dashboard/src/lib/use-authed-query";

const DEAL = {
  id: "deal-1",
  brand_name: "Glow Labs",
  brand_contact_email: "ari@example.com",
  brand_contact_name: "Ari",
  stage: "discovered",
  fit_score: 91,
  estimated_value_cents: 250000,
  actual_value_cents: null,
  pitch_text: null,
  pitch_sent_at: null,
  response_text: null,
  responded_at: null,
  contract_notes: null,
  notes: "Well matched skincare sponsor.",
  metadata: {},
  created_at: "2026-03-21T08:30:00.000Z",
  updated_at: "2026-03-21T09:30:00.000Z",
};

describe("DealsPage", () => {
  it("keeps stage moves action-safe by showing API errors on the deal card", async () => {
    vi.mocked(patchDealStage).mockRejectedValue(
      new Error("Stage move blocked by policy"),
    );
    vi.mocked(useAuthedQuery).mockImplementation((queryFn: unknown) => {
      if (queryFn === fetchDeals) {
        return {
          data: [DEAL],
          error: null,
          isLoading: false,
          refresh: vi.fn(),
          setData: vi.fn(),
        };
      }
      if (queryFn === fetchAgentState) {
        return {
          data: { messages: [], pendingApprovals: [] },
          error: null,
          isLoading: false,
          refresh: vi.fn(),
          setData: vi.fn(),
        };
      }
      return {
        data: null,
        error: null,
        isLoading: false,
        refresh: vi.fn(),
        setData: vi.fn(),
      };
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const { unmount } = render(React.createElement(DealsPage), container);

    const pitchButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Pitch now"),
    );
    expect(pitchButton).toBeTruthy();

    await act(async () => {
      pitchButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Stage move blocked by policy");

    unmount();
    container.remove();
  });
});
