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
    createDashboardDeal: vi.fn(),
    updateDashboardDeal: vi.fn(),
    skipAgentAction: vi.fn(),
  };
});

import DealsPage from "../../../dashboard/src/app/dashboard/deals/page";
import { DealForm } from "../../../dashboard/src/components/deals/deal-form";
import { DealDetail } from "../../../dashboard/src/components/deals/deal-detail";
import {
  fetchAgentState,
  fetchDeals,
  patchDealStage,
} from "../../../dashboard/src/lib/api";
import { useAuthedQuery } from "../../../dashboard/src/lib/use-authed-query";
import {
  applyOptimisticDealEdit,
  makeOptimisticDeal,
  replaceOptimisticDeal,
} from "../../../dashboard/src/lib/deal-optimistic";

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
  source_url: "https://example.com/opportunity",
  source_confidence: 88,
  source_evidence: [{ source: "brand-site" }],
  deliverables: [{ type: "video" }],
  next_action: "Reply to Ari",
  deadline_at: "2026-04-01T00:00:00.000Z",
  follow_up_at: null,
  probability: 70,
  agent_provenance: { skill: "brand-deal-scanner" },
  archived_at: null,
};

describe("DealsPage", () => {
  it("replaces a temporary create on success and removes it on rollback", () => {
    const temporary = makeOptimisticDeal({ brandName: "New Brand" }, "temp-1");
    const saved = { ...DEAL, id: "server-1", brand_name: "New Brand" } as never;
    expect(replaceOptimisticDeal([temporary], "temp-1", saved)).toEqual([
      saved,
    ]);
    expect(replaceOptimisticDeal([temporary], "temp-1")).toEqual([]);
  });

  it("optimistically edits material fields while preserving evidence and provenance for rollback", () => {
    const original = DEAL as never;
    const edited = applyOptimisticDealEdit(original, {
      brandName: "Glow Labs Updated",
      nextAction: "Send contract",
    });
    expect(edited.brand_name).toBe("Glow Labs Updated");
    expect(edited.next_action).toBe("Send contract");
    expect(edited.source_evidence).toEqual(DEAL.source_evidence);
    expect(edited.agent_provenance).toEqual(DEAL.agent_provenance);
    // Rollback is the untouched snapshot retained by the page.
    expect(original.brand_name).toBe("Glow Labs");
  });

  it("applies archive and restore payloads without altering deal evidence", () => {
    const archived = applyOptimisticDealEdit(DEAL as never, {
      archivedAt: "2026-07-11T12:00:00.000Z",
    });
    expect(archived.archived_at).toBe("2026-07-11T12:00:00.000Z");
    expect(archived.source_evidence).toEqual(DEAL.source_evidence);
    const restored = applyOptimisticDealEdit(archived, { archivedAt: null });
    expect(restored.archived_at).toBeNull();
  });

  it("shows local validation and supports Escape cancellation in the form", async () => {
    const onCancel = vi.fn();
    const onSubmit = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const { unmount } = render(
      React.createElement(DealForm, { onCancel, onSubmit }),
      container,
    );
    const email = container.querySelector('input[type="email"]')!;
    const brand = container.querySelector("input")!;
    await act(async () => {
      brand.dispatchEvent(new Event("input", { bubbles: true }));
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.call(email, "bad-email");
      email.dispatchEvent(new Event("input", { bubbles: true }));
      container
        .querySelector("form")
        ?.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
    });
    expect(container.textContent).toContain("Brand name is required");
    expect(container.textContent).toContain("Enter a valid email");
    expect(onSubmit).not.toHaveBeenCalled();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onCancel).toHaveBeenCalled();
    unmount();
    container.remove();
  });

  it("surfaces server validation for every field, not only primary identity fields", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const { unmount } = render(
      React.createElement(DealForm, {
        onCancel: vi.fn(),
        onSubmit: vi.fn(),
        serverError: "Validation failed",
        serverFieldErrors: {
          probability: ["Probability must be between 0 and 100"],
          followUpAt: ["Follow up must be a valid date"],
        },
      }),
      container,
    );
    expect(container.textContent).toContain(
      "Probability must be between 0 and 100",
    );
    expect(container.textContent).toContain("Follow up must be a valid date");
    unmount();
    container.remove();
  });

  it("renders read-only evidence, deliverables, and agent provenance in detail", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const { unmount } = render(
      React.createElement(DealDetail, {
        deal: DEAL as never,
        onClose: vi.fn(),
        onEdit: vi.fn(),
      }),
      container,
    );
    expect(container.textContent).toContain("Evidence");
    expect(container.textContent).toContain("brand-site");
    expect(container.textContent).toContain("Deliverables");
    expect(container.textContent).toContain("Agent provenance");
    expect(container.textContent).toContain("brand-deal-scanner");
    unmount();
    container.remove();
  });

  it("exposes keyboard-operable create and deal-detail controls", () => {
    vi.mocked(useAuthedQuery).mockImplementation((queryFn: unknown) => ({
      data:
        queryFn === fetchDeals
          ? [DEAL]
          : { messages: [], pendingApprovals: [] },
      error: null,
      isLoading: false,
      refresh: vi.fn(),
      setData: vi.fn(),
    }));
    const container = document.createElement("div");
    document.body.appendChild(container);
    const { unmount } = render(React.createElement(DealsPage), container);
    expect(
      Array.from(container.querySelectorAll("button")).some((button) =>
        button.textContent?.includes("Add deal"),
      ),
    ).toBe(true);
    expect(
      container.querySelector('[aria-label="View Glow Labs deal details"]'),
    ).toBeTruthy();
    unmount();
    container.remove();
  });

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
