import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/auth/session.js", () => ({
  authenticateAccessToken: vi.fn(),
}));

vi.mock("../../../src/messaging/linking.js", () => ({
  issueMessagingLinkSession: vi.fn(),
}));

import { createApiServer } from "../../../src/api/server.js";
import { messaging } from "../../../src/api/routes/messaging.js";
import { authenticateAccessToken } from "../../../src/auth/session.js";
import { issueMessagingLinkSession } from "../../../src/messaging/linking.js";

describe("messaging link routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticateAccessToken).mockResolvedValue({
      accessToken: "access-token",
      creatorId: "5f4aa8d8-2fe8-4ae6-84e2-f452ca785d88",
      privyUserId: "did:privy:user-1",
    });
    vi.mocked(issueMessagingLinkSession).mockResolvedValue({
      platform: "telegram",
      token: "token-123",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      command: "/start link_token-123",
      launchUrl: null,
    } as never);
  });

  it("creates a Telegram connect link for the authenticated creator", async () => {
    const app = createApiServer();
    app.route("/api/messaging-links", messaging);

    const response = await app.request("/api/messaging-links/telegram", {
      method: "POST",
      headers: { Authorization: "Bearer access-token" },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.platform).toBe("telegram");
    expect(body.token).toBeTruthy();
    expect(body.command).toContain("/start link_");
    expect(issueMessagingLinkSession).toHaveBeenCalledWith({
      creatorId: "5f4aa8d8-2fe8-4ae6-84e2-f452ca785d88",
      platform: "telegram",
    });
  });

  it("creates a WhatsApp connect instruction for the authenticated creator", async () => {
    const app = createApiServer();
    app.route("/api/messaging-links", messaging);
    vi.mocked(issueMessagingLinkSession).mockResolvedValueOnce({
      platform: "whatsapp",
      token: "token-456",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      command: "LINK token-456",
      launchUrl: null,
    } as never);

    const response = await app.request("/api/messaging-links/whatsapp", {
      method: "POST",
      headers: { Authorization: "Bearer access-token" },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.platform).toBe("whatsapp");
    expect(body.command).toContain("LINK ");
  });

  it("rejects unsupported messaging platforms", async () => {
    const app = createApiServer();
    app.route("/api/messaging-links", messaging);

    const response = await app.request("/api/messaging-links/signal", {
      method: "POST",
      headers: { Authorization: "Bearer access-token" },
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.message).toContain("Unsupported messaging platform");
  });
});
