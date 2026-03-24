import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildPlatformOAuthRedirect,
  buildPlatformOAuthUrl,
  createPlatformOAuthState,
  exchangeYouTubeOAuthCode,
  fetchYouTubeChannelIdentity,
  getPlatformOAuthProviders,
  getYouTubeOAuthConfigStatus,
  verifyPlatformOAuthState,
} from "../../../src/platforms/oauth.js";

describe("platform OAuth helpers", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.PRIVY_APP_SECRET = "privy-secret-for-state";
    process.env.GOOGLE_OAUTH_CLIENT_ID = "google-client-id";
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "google-client-secret";
    process.env.YOUTUBE_OAUTH_REDIRECT_URI =
      "http://localhost:3000/api/platforms/oauth/youtube/callback";
    process.env.DASHBOARD_APP_URL = "http://localhost:3001";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it("reports YouTube as enabled only when OAuth env is fully configured", () => {
    expect(getPlatformOAuthProviders()).toEqual([
      expect.objectContaining({
        platform: "youtube",
        enabled: true,
      }),
    ]);

    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "";

    expect(getPlatformOAuthProviders()).toEqual([
      expect.objectContaining({
        platform: "youtube",
        enabled: false,
      }),
    ]);
  });

  it("reports which YouTube OAuth env vars are missing", () => {
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "";
    process.env.YOUTUBE_OAUTH_REDIRECT_URI = "";

    expect(getYouTubeOAuthConfigStatus()).toEqual({
      enabled: false,
      missing: [
        "GOOGLE_OAUTH_CLIENT_SECRET",
        "YOUTUBE_OAUTH_REDIRECT_URI",
      ],
    });
  });

  it("creates a signed state token that verifies for the same platform", () => {
    const state = createPlatformOAuthState({
      creatorId: "creator-1",
      privyUserId: "did:privy:creator-1",
      platform: "youtube",
    });

    expect(
      verifyPlatformOAuthState({
        platform: "youtube",
        state,
      })
    ).toEqual(
      expect.objectContaining({
        creatorId: "creator-1",
        privyUserId: "did:privy:creator-1",
        platform: "youtube",
      })
    );
  });

  it("rejects a tampered state token", () => {
    const state = createPlatformOAuthState({
      creatorId: "creator-1",
      privyUserId: "did:privy:creator-1",
      platform: "youtube",
    });
    const parts = state.split(".");
    const tampered = `${parts[0]}.invalid-signature`;

    expect(() =>
      verifyPlatformOAuthState({
        platform: "youtube",
        state: tampered,
      })
    ).toThrow(/Invalid OAuth state signature/);
  });

  it("rejects a state token with extra segments", () => {
    const state = createPlatformOAuthState({
      creatorId: "creator-1",
      privyUserId: "did:privy:creator-1",
      platform: "youtube",
    });

    expect(() =>
      verifyPlatformOAuthState({
        platform: "youtube",
        state: `${state}.junk`,
      })
    ).toThrow(/Invalid OAuth state format/);
  });

  it("rejects an expired state token", () => {
    const now = new Date("2026-03-19T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-19T11:40:00.000Z"));

    const state = createPlatformOAuthState({
      creatorId: "creator-1",
      privyUserId: "did:privy:creator-1",
      platform: "youtube",
    });

    expect(() =>
      verifyPlatformOAuthState({
        platform: "youtube",
        state,
        now,
      })
    ).toThrow(/OAuth state has expired/);

    vi.useRealTimers();
  });

  it("builds the Google auth URL with offline YouTube access and signed state", () => {
    const url = new URL(
      buildPlatformOAuthUrl({
        creatorId: "creator-1",
        privyUserId: "did:privy:creator-1",
        platform: "youtube",
      })
    );

    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.pathname).toBe("/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("google-client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/api/platforms/oauth/youtube/callback"
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("scope")).toBe(
      "https://www.googleapis.com/auth/youtube.readonly"
    );

    expect(
      verifyPlatformOAuthState({
        platform: "youtube",
        state: url.searchParams.get("state") ?? "",
      })
    ).toEqual(
      expect.objectContaining({
        creatorId: "creator-1",
      })
    );
  });

  it("rejects building the Google auth URL when the YouTube OAuth config is partial", () => {
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "";

    expect(() =>
      buildPlatformOAuthUrl({
        creatorId: "creator-1",
        privyUserId: "did:privy:creator-1",
        platform: "youtube",
      })
    ).toThrow(/YouTube OAuth is not configured/);
  });

  it("exchanges the OAuth code for YouTube tokens", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "oauth-access-token",
          refresh_token: "oauth-refresh-token",
          expires_in: 3600,
          scope: "https://www.googleapis.com/auth/youtube.readonly",
          token_type: "Bearer",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(exchangeYouTubeOAuthCode("oauth-code")).resolves.toEqual(
      expect.objectContaining({
        accessToken: "oauth-access-token",
        refreshToken: "oauth-refresh-token",
        expiresIn: 3600,
      })
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://oauth2.googleapis.com/token",
      expect.objectContaining({
        method: "POST",
        body: expect.any(URLSearchParams),
      })
    );
  });

  it("rejects token exchange responses that are not successful", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "invalid_grant" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    await expect(exchangeYouTubeOAuthCode("oauth-code")).rejects.toThrow(
      /token exchange failed with status 400/i
    );
  });

  it("rejects token exchange responses without an access token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ refresh_token: "oauth-refresh-token" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    await expect(exchangeYouTubeOAuthCode("oauth-code")).rejects.toThrow(
      /did not return an access token/i
    );
  });

  it("propagates token exchange network failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down"))
    );

    await expect(exchangeYouTubeOAuthCode("oauth-code")).rejects.toThrow(
      /network down/
    );
  });

  it("fetches the YouTube channel identity for the authenticated creator", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
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
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchYouTubeChannelIdentity("oauth-access-token")
    ).resolves.toEqual({
      channelId: "channel-123",
      title: "Creator Channel",
      handle: "@creator-channel",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer oauth-access-token",
        }),
      })
    );
  });

  it("rejects channel identity responses that are not successful", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: "forbidden" } }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    await expect(
      fetchYouTubeChannelIdentity("oauth-access-token")
    ).rejects.toThrow(/channel lookup failed with status 403/i);
  });

  it("rejects channel identity responses without a usable channel", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    await expect(
      fetchYouTubeChannelIdentity("oauth-access-token")
    ).rejects.toThrow(/did not return a channel identity/i);
  });

  it("propagates channel identity network failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("youtube unavailable"))
    );

    await expect(
      fetchYouTubeChannelIdentity("oauth-access-token")
    ).rejects.toThrow(/youtube unavailable/);
  });

  it("builds callback redirects back to dashboard settings with explicit status", () => {
    expect(
      buildPlatformOAuthRedirect({
        platform: "youtube",
        status: "success",
      })
    ).toBe(
      "http://localhost:3001/dashboard/settings?oauth=success&platform=youtube"
    );

    expect(
      buildPlatformOAuthRedirect({
        platform: "youtube",
        status: "error",
        error: "token_exchange_failed",
      })
    ).toBe(
      "http://localhost:3001/dashboard/settings?oauth=error&platform=youtube&error=token_exchange_failed"
    );
  });
});
