import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

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
import { createPlatformOAuthState } from "../../../src/platforms/oauth.js";
import { getCreatorById } from "../../../src/db/queries/creators.js";
import { upsertConnection } from "../../../src/db/queries/platform-connections.js";

describe("platform OAuth routes", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_OAUTH_CLIENT_ID = "google-client-id";
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "google-client-secret";
    process.env.YOUTUBE_OAUTH_REDIRECT_URI =
      "http://localhost:3000/api/platforms/oauth/youtube/callback";
    process.env.DASHBOARD_APP_URL = "http://localhost:3001";
    process.env.PRIVY_APP_SECRET = "privy-secret-for-state";

    vi.mocked(authenticateAccessToken).mockResolvedValue({
      accessToken: "access-token",
      creatorId: "creator-1",
      privyUserId: "did:privy:creator-1",
    });
    vi.mocked(getCreatorById).mockResolvedValue({
      id: "creator-1",
      privy_user_id: "did:privy:creator-1",
    } as never);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it("lists configured OAuth providers for the authenticated creator", async () => {
    const app = createApiServer();
    app.route("/api/platforms", platforms);

    const response = await app.request("/api/platforms/oauth/providers", {
      headers: { Authorization: "Bearer access-token" },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([
      expect.objectContaining({
        platform: "youtube",
        enabled: true,
      }),
    ]);
  });

  it("returns a signed YouTube OAuth start URL", async () => {
    const app = createApiServer();
    app.route("/api/platforms", platforms);

    const response = await app.request("/api/platforms/oauth/youtube/start", {
      method: "POST",
      headers: { Authorization: "Bearer access-token" },
    });
    const body = await response.json();
    const url = new URL(body.url);

    expect(response.status).toBe(200);
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("client_id")).toBe("google-client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/api/platforms/oauth/youtube/callback",
    );
    expect(url.searchParams.get("state")).toBeTruthy();
  });

  it("fails OAuth start when the YouTube OAuth config is partial", async () => {
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "";

    const app = createApiServer();
    app.route("/api/platforms", platforms);

    const response = await app.request("/api/platforms/oauth/youtube/start", {
      method: "POST",
      headers: { Authorization: "Bearer access-token" },
    });
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: "YouTube OAuth is not configured",
      missing: ["GOOGLE_OAUTH_CLIENT_SECRET"],
    });
  });

  it("rejects unauthenticated OAuth start requests", async () => {
    const app = createApiServer();
    app.route("/api/platforms", platforms);

    const response = await app.request("/api/platforms/oauth/youtube/start", {
      method: "POST",
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toContain("Missing bearer token");
  });

  it("exchanges the callback code, stores the connection, and redirects back to settings", async () => {
    const app = createApiServer();
    app.route("/api/platforms", platforms);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "oauth-access-token",
            refresh_token: "oauth-refresh-token",
            expires_in: 3600,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              {
                id: "channel-123",
                snippet: {
                  title: "Creator Channel",
                  customUrl: "@creator-channel",
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(upsertConnection).mockResolvedValue({
      id: "conn-1",
      creator_id: "creator-1",
      platform: "youtube",
      access_token: "oauth-access-token",
      refresh_token: "oauth-refresh-token",
      platform_user_id: "channel-123",
      platform_username: "@creator-channel",
      metadata: {},
      expires_at: "2026-03-19T01:00:00.000Z",
      created_at: "2026-03-19T00:00:00.000Z",
    } as never);

    const state = createPlatformOAuthState({
      creatorId: "creator-1",
      privyUserId: "did:privy:creator-1",
      platform: "youtube",
    });

    const response = await app.request(
      `/api/platforms/oauth/youtube/callback?code=oauth-code&state=${encodeURIComponent(state)}`,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3001/dashboard/settings?oauth=success&platform=youtube",
    );
    expect(upsertConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        creator_id: "creator-1",
        platform: "youtube",
        platform_user_id: "channel-123",
        platform_username: "@creator-channel",
        metadata: expect.objectContaining({
          connection_method: "oauth",
        }),
        access_token: "oauth-access-token",
        refresh_token: "oauth-refresh-token",
      }),
    );
    expect(getCreatorById).toHaveBeenCalledWith("creator-1");
  });

  it("redirects back to settings when callback state is invalid or expired", async () => {
    const app = createApiServer();
    app.route("/api/platforms", platforms);

    const response = await app.request(
      "/api/platforms/oauth/youtube/callback?code=oauth-code&state=invalid-state",
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3001/dashboard/settings?oauth=error&platform=youtube&error=invalid_or_expired_state",
    );
    expect(upsertConnection).not.toHaveBeenCalled();
  });

  it("redirects back to settings when callback is missing the code or state", async () => {
    const app = createApiServer();
    app.route("/api/platforms", platforms);

    const state = createPlatformOAuthState({
      creatorId: "creator-1",
      privyUserId: "did:privy:creator-1",
      platform: "youtube",
    });

    const response = await app.request(
      `/api/platforms/oauth/youtube/callback?state=${encodeURIComponent(state)}`,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3001/dashboard/settings?oauth=error&platform=youtube&error=missing_code_or_state",
    );
    expect(upsertConnection).not.toHaveBeenCalled();
  });

  it("redirects back to settings when the provider denies consent", async () => {
    const app = createApiServer();
    app.route("/api/platforms", platforms);

    const state = createPlatformOAuthState({
      creatorId: "creator-1",
      privyUserId: "did:privy:creator-1",
      platform: "youtube",
    });

    const response = await app.request(
      `/api/platforms/oauth/youtube/callback?error=access_denied&state=${encodeURIComponent(state)}`,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3001/dashboard/settings?oauth=error&platform=youtube&error=provider_access_denied",
    );
    expect(upsertConnection).not.toHaveBeenCalled();
  });

  it("redirects back to settings when callback OAuth config is missing", async () => {
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "";

    const app = createApiServer();
    app.route("/api/platforms", platforms);

    const state = createPlatformOAuthState({
      creatorId: "creator-1",
      privyUserId: "did:privy:creator-1",
      platform: "youtube",
    });

    const response = await app.request(
      `/api/platforms/oauth/youtube/callback?code=oauth-code&state=${encodeURIComponent(state)}`,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3001/dashboard/settings?oauth=error&platform=youtube&error=oauth_not_configured",
    );
    expect(upsertConnection).not.toHaveBeenCalled();
  });

  it("redirects back to settings when the callback platform is unsupported", async () => {
    const app = createApiServer();
    app.route("/api/platforms", platforms);

    const response = await app.request(
      "/api/platforms/oauth/tiktok/callback?code=oauth-code&state=some-state",
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3001/dashboard/settings?oauth=error&platform=tiktok&error=unsupported_platform",
    );
    expect(upsertConnection).not.toHaveBeenCalled();
  });

  it("redirects back to settings when token exchange fails during the callback", async () => {
    const app = createApiServer();
    app.route("/api/platforms", platforms);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "bad request" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const state = createPlatformOAuthState({
      creatorId: "creator-1",
      privyUserId: "did:privy:creator-1",
      platform: "youtube",
    });

    const response = await app.request(
      `/api/platforms/oauth/youtube/callback?code=oauth-code&state=${encodeURIComponent(state)}`,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3001/dashboard/settings?oauth=error&platform=youtube&error=provider_callback_failed",
    );
    expect(upsertConnection).not.toHaveBeenCalled();
  });

  it("redirects back to settings when channel lookup fails during the callback", async () => {
    const app = createApiServer();
    app.route("/api/platforms", platforms);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "oauth-access-token",
            refresh_token: "oauth-refresh-token",
            expires_in: 3600,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "forbidden" } }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const state = createPlatformOAuthState({
      creatorId: "creator-1",
      privyUserId: "did:privy:creator-1",
      platform: "youtube",
    });

    const response = await app.request(
      `/api/platforms/oauth/youtube/callback?code=oauth-code&state=${encodeURIComponent(state)}`,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3001/dashboard/settings?oauth=error&platform=youtube&error=provider_callback_failed",
    );
    expect(upsertConnection).not.toHaveBeenCalled();
  });

  it("redirects back to settings when saving the connection fails", async () => {
    const app = createApiServer();
    app.route("/api/platforms", platforms);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "oauth-access-token",
            refresh_token: "oauth-refresh-token",
            expires_in: 3600,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              {
                id: "channel-123",
                snippet: {
                  title: "Creator Channel",
                  customUrl: "@creator-channel",
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(upsertConnection).mockRejectedValue(new Error("write failed"));

    const state = createPlatformOAuthState({
      creatorId: "creator-1",
      privyUserId: "did:privy:creator-1",
      platform: "youtube",
    });

    const response = await app.request(
      `/api/platforms/oauth/youtube/callback?code=oauth-code&state=${encodeURIComponent(state)}`,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3001/dashboard/settings?oauth=error&platform=youtube&error=persistence_failed",
    );
    expect(upsertConnection).toHaveBeenCalledTimes(1);
  });

  it("redirects back to settings when creator lookup fails during the callback", async () => {
    const app = createApiServer();
    app.route("/api/platforms", platforms);

    vi.mocked(getCreatorById).mockRejectedValue(new Error("db unavailable"));

    const state = createPlatformOAuthState({
      creatorId: "creator-1",
      privyUserId: "did:privy:creator-1",
      platform: "youtube",
    });

    const response = await app.request(
      `/api/platforms/oauth/youtube/callback?code=oauth-code&state=${encodeURIComponent(state)}`,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3001/dashboard/settings?oauth=error&platform=youtube&error=creator_lookup_failed",
    );
    expect(upsertConnection).not.toHaveBeenCalled();
  });

  it("rejects the callback when the Privy-bound creator no longer matches the signed state", async () => {
    const app = createApiServer();
    app.route("/api/platforms", platforms);

    vi.mocked(getCreatorById).mockResolvedValue({
      id: "creator-1",
      privy_user_id: "did:privy:someone-else",
    } as never);

    const state = createPlatformOAuthState({
      creatorId: "creator-1",
      privyUserId: "did:privy:creator-1",
      platform: "youtube",
    });

    const response = await app.request(
      `/api/platforms/oauth/youtube/callback?code=oauth-code&state=${encodeURIComponent(state)}`,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3001/dashboard/settings?oauth=error&platform=youtube&error=creator_auth_mismatch",
    );
    expect(upsertConnection).not.toHaveBeenCalled();
  });

  it("rejects the callback when the creator from signed state no longer exists", async () => {
    const app = createApiServer();
    app.route("/api/platforms", platforms);

    vi.mocked(getCreatorById).mockResolvedValue(null);

    const state = createPlatformOAuthState({
      creatorId: "creator-1",
      privyUserId: "did:privy:creator-1",
      platform: "youtube",
    });

    const response = await app.request(
      `/api/platforms/oauth/youtube/callback?code=oauth-code&state=${encodeURIComponent(state)}`,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3001/dashboard/settings?oauth=error&platform=youtube&error=creator_auth_mismatch",
    );
    expect(upsertConnection).not.toHaveBeenCalled();
  });
});
