import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/auth/session.js", () => ({
  authenticateAccessToken: vi.fn(),
}));

vi.mock("../../../src/db/queries/messages.js", () => ({
  getConversationHistory: vi.fn(),
  saveMessage: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../../src/bot/approval.js", () => ({
  getPendingApprovalByAction: vi.fn(),
  getPendingApprovalsForCreator: vi.fn(),
  markApprovalApproved: vi.fn(),
  markApprovalExecuted: vi.fn(),
  markApprovalSkipped: vi.fn(),
  storePendingApproval: vi.fn(),
}));

vi.mock("../../../src/agent/orchestrator.js", () => ({
  runAgent: vi.fn(),
}));

vi.mock("../../../src/agent/conversation.js", () => ({
  processCreatorMessage: vi.fn(),
}));

vi.mock("../../../src/db/queries/creators.js", () => ({
  getCreatorById: vi.fn(),
}));

vi.mock("../../../src/agent/tools/registry.js", () => ({
  getTool: vi.fn(),
}));

vi.mock("../../../src/wallet/privy.js", () => ({
  resolveWalletForCreator: vi.fn(),
}));

vi.mock("../../../src/wallet/mpp.js", () => ({
  createMppClient: vi.fn(),
  getOnChainBalance: vi
    .fn()
    .mockResolvedValue({ balanceCents: 100000, balanceFormatted: "1.00" }),
}));

import { Hono } from "hono";
import { authenticateAccessToken } from "../../../src/auth/session.js";
import { runAgent } from "../../../src/agent/orchestrator.js";
import { processCreatorMessage } from "../../../src/agent/conversation.js";
import { getTool } from "../../../src/agent/tools/registry.js";
import {
  getPendingApprovalByAction,
  getPendingApprovalsForCreator,
  markApprovalApproved,
  markApprovalExecuted,
  markApprovalSkipped,
  storePendingApproval,
} from "../../../src/bot/approval.js";
import { getCreatorById } from "../../../src/db/queries/creators.js";
import {
  getConversationHistory,
  saveMessage,
} from "../../../src/db/queries/messages.js";
import { createMppClient } from "../../../src/wallet/mpp.js";
import { resolveWalletForCreator } from "../../../src/wallet/privy.js";
import { agent } from "../../../src/api/routes/agent.js";

describe("agent API", () => {
  const app = new Hono();
  app.route("/agent", agent);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticateAccessToken).mockResolvedValue({
      accessToken: "access-token",
      creatorId: "creator-1",
      privyUserId: "did:privy:user-1",
    });
  });

  it("GET /agent/state returns message history and pending approvals for the creator", async () => {
    vi.mocked(getConversationHistory).mockResolvedValue([
      {
        id: "msg-1",
        creator_id: "creator-1",
        role: "user",
        content: "Show my wallet balance",
        metadata: { platform: "dashboard" },
        created_at: "2026-03-20T09:00:00.000Z",
      },
    ] as never);
    vi.mocked(getPendingApprovalsForCreator).mockResolvedValue([
      {
        id: "action-1",
        creatorId: "creator-1",
        actionId: "action-1",
        type: "email_sender",
        description: "Send pitch email",
        preview: "Draft pitch ready",
        input: { brand: "Acme" },
      },
    ] as never);

    const response = await app.request("/agent/state", {
      headers: { Authorization: "Bearer access-token" },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.messages).toHaveLength(1);
    expect(body.pendingApprovals).toHaveLength(1);
  });

  it("POST /agent/messages persists the conversation and returns approval metadata when needed", async () => {
    vi.mocked(processCreatorMessage).mockResolvedValue({
      text: "I drafted a pitch for Acme.",
      requiresApproval: true,
      pendingAction: {
        id: "action-1",
        type: "email_sender",
        description: "Send pitch email",
        input: { to: "brand@acme.com" },
      },
    });
    vi.mocked(getPendingApprovalsForCreator).mockResolvedValue([
      {
        id: "action-1",
        creatorId: "creator-1",
        actionId: "action-1",
        type: "email_sender",
        description: "Send pitch email",
        preview: "I drafted a pitch for Acme.",
        input: { to: "brand@acme.com" },
      } as never,
    ]);

    const response = await app.request("/agent/messages", {
      method: "POST",
      headers: {
        Authorization: "Bearer access-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: "Draft an Acme pitch" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(processCreatorMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        creatorId: "creator-1",
        text: "Draft an Acme pitch",
      }),
    );
    expect(body.reply.requiresApproval).toBe(true);
    expect(body.pendingApprovals).toHaveLength(1);
  });

  it("POST /agent/approvals/:actionId/approve executes the approved tool for the creator", async () => {
    vi.mocked(getPendingApprovalByAction).mockResolvedValue({
      id: "action-1",
      creatorId: "creator-1",
      actionId: "action-1",
      type: "email_sender",
      description: "Send pitch email",
      preview: "Draft pitch ready",
      input: { to: "brand@acme.com" },
    } as never);
    vi.mocked(getCreatorById).mockResolvedValue({
      id: "creator-1",
      wallet_id: "wallet-1",
      wallet_address: "0x123",
    } as never);
    vi.mocked(resolveWalletForCreator).mockResolvedValue({
      walletId: "wallet-1",
      address: "0x123",
    } as never);
    vi.mocked(createMppClient).mockResolvedValue({
      fetch: vi.fn(),
    } as never);
    vi.mocked(getTool).mockReturnValue({
      execute: vi.fn().mockResolvedValue({
        success: true,
        data: "Pitch email sent.",
        costCents: 42,
      }),
    } as never);
    vi.mocked(markApprovalApproved).mockResolvedValue(true as never);
    vi.mocked(getPendingApprovalsForCreator).mockResolvedValue([]);

    const response = await app.request("/agent/approvals/action-1/approve", {
      method: "POST",
      headers: { Authorization: "Bearer access-token" },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(markApprovalApproved).toHaveBeenCalledWith("action-1");
    expect(markApprovalExecuted).toHaveBeenCalledWith(
      "action-1",
      {
        success: true,
        data: "Pitch email sent.",
      },
      42,
    );
    expect(body.execution.message).toBe("Pitch email sent.");
  });

  it("POST /agent/approvals/:actionId/approve rejects duplicate approval execution", async () => {
    vi.mocked(getPendingApprovalByAction).mockResolvedValue({
      id: "action-1",
      creatorId: "creator-1",
      actionId: "action-1",
      type: "email_sender",
      description: "Send pitch email",
      preview: "Draft pitch ready",
      input: { to: "brand@acme.com" },
    } as never);
    vi.mocked(getCreatorById).mockResolvedValue({
      id: "creator-1",
      wallet_id: "wallet-1",
      wallet_address: "0x123",
    } as never);
    vi.mocked(resolveWalletForCreator).mockResolvedValue({
      walletId: "wallet-1",
      address: "0x123",
    } as never);
    vi.mocked(createMppClient).mockResolvedValue({ fetch: vi.fn() } as never);
    vi.mocked(getTool).mockReturnValue({
      execute: vi.fn().mockResolvedValue({ success: true, data: "sent" }),
    } as never);
    vi.mocked(markApprovalApproved).mockResolvedValue(false as never);

    const response = await app.request("/agent/approvals/action-1/approve", {
      method: "POST",
      headers: { Authorization: "Bearer access-token" },
    });

    expect(response.status).toBe(404);
  });

  it("POST /agent/approvals/:actionId/skip marks the approval as skipped", async () => {
    vi.mocked(getPendingApprovalByAction).mockResolvedValue({
      id: "action-1",
      creatorId: "creator-1",
      actionId: "action-1",
      type: "email_sender",
      description: "Send pitch email",
      preview: "Draft pitch ready",
      input: { to: "brand@acme.com" },
    } as never);
    vi.mocked(getPendingApprovalsForCreator).mockResolvedValue([]);

    const response = await app.request("/agent/approvals/action-1/skip", {
      method: "POST",
      headers: { Authorization: "Bearer access-token" },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(markApprovalSkipped).toHaveBeenCalledWith("action-1");
    expect(body.pendingApprovals).toEqual([]);
  });
});
