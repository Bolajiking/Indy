import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/auth/session.js", () => ({
  authenticateAccessToken: vi.fn(),
}));

vi.mock("../../../src/db/queries/platform-connections.js", () => ({
  deleteConnectionById: vi.fn(),
  getConnection: vi.fn(),
  getConnectionsForCreator: vi.fn(),
  upsertConnection: vi.fn(),
}));

vi.mock("../../../src/db/queries/creators.js", () => ({
  getCreatorById: vi.fn(),
}));

import { authenticateAccessToken } from "../../../src/auth/session.js";
import { createApiServer } from "../../../src/api/server.js";
import { platforms } from "../../../src/api/routes/platforms.js";
import {
  deleteConnectionById,
  getConnection,
  getConnectionsForCreator,
  upsertConnection,
} from "../../../src/db/queries/platform-connections.js";

describe("platform routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticateAccessToken).mockResolvedValue({
      accessToken: "access-token",
      creatorId: "creator-1",
      privyUserId: "did:privy:creator-1",
    });
  });

  it("lists safe platform connection data for the authenticated creator", async () => {
    vi.mocked(getConnectionsForCreator).mockResolvedValue([
      {
        id: "conn-1",
        creator_id: "creator-1",
        platform: "youtube",
        access_token: "secret",
        refresh_token: "refresh",
        platform_user_id: "123",
        platform_username: "creator-channel",
        metadata: {},
        expires_at: null,
        created_at: "2026-03-19T00:00:00.000Z",
      } as never,
    ]);

    const app = createApiServer();
    app.route("/api/platforms", platforms);

    const response = await app.request("/api/platforms", {
      headers: { Authorization: "Bearer access-token" },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([
      expect.objectContaining({
        id: "conn-1",
        platform: "youtube",
        platform_username: "creator-channel",
        connected: true,
      }),
    ]);
    expect(body[0].access_token).toBeUndefined();
    expect(body[0].refresh_token).toBeUndefined();
  });

  it("delegates platform credentials to the persistence boundary", async () => {
    vi.mocked(upsertConnection).mockResolvedValue({
      id: "conn-1",
      creator_id: "creator-1",
      platform: "youtube",
      access_token: "encrypted",
      refresh_token: "encrypted-refresh",
      platform_user_id: null,
      platform_username: "creator-channel",
      metadata: {},
      expires_at: null,
      created_at: "2026-03-19T00:00:00.000Z",
    } as never);

    const app = createApiServer();
    app.route("/api/platforms", platforms);

    const response = await app.request("/api/platforms/connect", {
      method: "POST",
      headers: {
        Authorization: "Bearer access-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        platform: "youtube",
        accessToken: "raw-access-token",
        refreshToken: "raw-refresh-token",
        username: "creator-channel",
      }),
    });

    expect(response.status).toBe(200);
    expect(upsertConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        creator_id: "creator-1",
        platform: "youtube",
        platform_username: "creator-channel",
        access_token: "raw-access-token",
        refresh_token: "raw-refresh-token",
      }),
    );
  });

  it("returns 500 when platform disconnect deletion fails", async () => {
    vi.mocked(getConnection).mockResolvedValue({
      id: "conn-1",
      creator_id: "creator-1",
      platform: "youtube",
    } as never);
    vi.mocked(deleteConnectionById).mockRejectedValue(
      new Error("delete failed"),
    );

    const app = createApiServer();
    app.route("/api/platforms", platforms);

    const response = await app.request("/api/platforms/youtube", {
      method: "DELETE",
      headers: { Authorization: "Bearer access-token" },
    });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.message).toBe("Failed to disconnect platform");
  });
});
