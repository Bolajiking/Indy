import { test as base, expect, type Page } from "@playwright/test";

const now = "2026-07-11T00:00:00.000Z";

export const sampleDeal = {
  id: "deal-e2e",
  brand_name: "Acme Studio",
  brand_contact_email: "brand@example.test",
  brand_contact_name: "Ari",
  stage: "lead",
  fit_score: 88,
  estimated_value_cents: 250000,
  actual_value_cents: null,
  archived_at: null as string | null,
  pitch_text: null,
  pitch_sent_at: null,
  response_text: null,
  responded_at: null,
  contract_notes: null,
  notes: "E2E fixture",
  metadata: {},
  created_at: now,
  updated_at: now,
};

async function installApiMock(page: Page) {
  let deals = [sampleDeal];
  await page.route("**/api/proxy/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/proxy/, "");
    const method = request.method();
    let body: unknown = {};

    if (path === "/api/deals" && method === "GET") body = deals;
    else if (path === "/api/deals" && method === "POST") {
      const input = request.postDataJSON() as { brandName: string };
      body = { ...sampleDeal, id: "deal-created", brand_name: input.brandName };
      deals = [...deals, body as typeof sampleDeal];
    } else if (path.includes("/api/deals/") && method === "PATCH") {
      const input = request.postDataJSON() as Record<string, unknown>;
      const current =
        deals.find((deal) => path.includes(deal.id)) ?? sampleDeal;
      body = {
        ...current,
        ...input,
        brand_name:
          (input.brandName as string | undefined) ?? current.brand_name,
        archived_at:
          (input.archivedAt as string | null | undefined) ??
          current.archived_at,
      };
      deals = deals.map((deal) =>
        deal.id === current.id ? (body as typeof deal) : deal,
      );
    } else if (path === "/api/agent/state") {
      body = { messages: [], pendingApprovals: [] };
    } else if (path === "/api/agent/messages" && method === "POST") {
      body = {
        messages: [
          {
            id: "message-user",
            creator_id: "creator-e2e",
            role: "user",
            content: "Send my pitch to Acme",
            metadata: {},
            created_at: now,
          },
          {
            id: "message-agent",
            creator_id: "creator-e2e",
            role: "assistant",
            content: "I prepared a safe preview for your approval.",
            metadata: {},
            created_at: now,
          },
        ],
        pendingApprovals: [
          {
            id: "pending-e2e",
            creatorId: "creator-e2e",
            actionId: "approval-e2e",
            type: "send_email",
            description: "Send pitch",
            preview: "Send pitch to brand@example.test",
            input: {},
          },
        ],
        reply: {
          text: "I prepared a safe preview for your approval.",
          requiresApproval: true,
        },
      };
    } else if (path.includes("/api/agent/approvals/")) {
      body = { response: "Approval recorded.", pendingApproval: null };
    } else if (path === "/api/connections") {
      body = { connections: [], available: [] };
    } else if (path === "/api/wallet/balance") {
      body = {
        address: "0x1111111111111111111111111111111111111111",
        balance: "0",
      };
    } else if (path === "/api/wallet/transactions") body = [];
    else if (path === "/api/wallet/payment-attempts") body = [];
    else if (path.includes("/api/reports/")) body = {};
    else if (path === "/api/account/export") body = { exportedAt: now };
    else if (path === "/api/account/deletion" && method === "DELETE") {
      body = { state: "requested", receipt: "e2e-receipt", expiresAt: now };
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "X-Request-Id": "e2e-request" },
      body: JSON.stringify(body),
    });
  });
}

export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ page }, use) => {
    await installApiMock(page);
    await use(page);
  },
});

export { expect };
