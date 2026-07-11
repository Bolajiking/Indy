import { Hono, type Context } from "hono";
import {
  deleteConnectionById,
  getConnectionsForCreator,
  getConnection,
  upsertConnection,
} from "../../db/queries/platform-connections.js";
import { getCreatorById } from "../../db/queries/creators.js";
import pino from "#logger";
import { getAuthContext, requireCreatorAuth } from "../middleware/auth.js";
import {
  buildPlatformOAuthRedirect,
  buildPlatformOAuthUrl,
  exchangeYouTubeOAuthCode,
  fetchYouTubeChannelIdentity,
  getPlatformOAuthProviders,
  getYouTubeOAuthConfigStatus,
  verifyPlatformOAuthState,
} from "../../platforms/oauth.js";
import { errMsg } from "../../lib/errors.js";
import type {
  ApiPlatformConnection,
  ApiPlatformConnectionInput,
  ApiPlatformOAuthProvider,
} from "../contracts.js";

const log = pino({ name: "api:platforms" });
const OAUTH_PLATFORM = "youtube";

export const platforms = new Hono();

function redirectToOAuthResult(
  c: Pick<Context, "redirect">,
  input: Parameters<typeof buildPlatformOAuthRedirect>[0],
) {
  return c.redirect(buildPlatformOAuthRedirect(input), 302);
}

/**
 * GET /platforms — List all connected platforms for the authenticated creator.
 */
platforms.get("/", requireCreatorAuth, async (c) => {
  const { creatorId } = getAuthContext(c);
  const connections = await getConnectionsForCreator(creatorId!);

  // Strip tokens from response
  const safe = connections.map((conn) => ({
    id: conn.id,
    platform: conn.platform,
    platform_username: conn.platform_username,
    platform_user_id: conn.platform_user_id,
    connected: true,
    created_at: conn.created_at,
  }));

  return c.json(safe satisfies ApiPlatformConnection[]);
});

/**
 * POST /platforms/connect — Connect a new platform.
 * Body: { platform, accessToken, refreshToken?, username?, userId?, expiresAt? }
 */
platforms.post("/connect", requireCreatorAuth, async (c) => {
  const { creatorId } = getAuthContext(c);
  const body = await c.req.json<ApiPlatformConnectionInput>();

  if (!body.platform || !body.accessToken) {
    return c.json({ error: "platform and accessToken are required" }, 400);
  }

  const supportedPlatforms = [
    "youtube",
    "instagram",
    "tiktok",
    "twitter",
    "facebook",
    "reddit",
  ];

  if (!supportedPlatforms.includes(body.platform.toLowerCase())) {
    return c.json(
      {
        error: `Unsupported platform. Supported: ${supportedPlatforms.join(", ")}`,
      },
      400,
    );
  }

  try {
    const connection = await upsertConnection({
      creator_id: creatorId!,
      platform: body.platform.toLowerCase(),
      access_token: body.accessToken,
      refresh_token: body.refreshToken ?? null,
      platform_username: body.username ?? null,
      platform_user_id: body.userId ?? null,
      metadata: {},
      expires_at: body.expiresAt ?? null,
    });

    log.info({ creatorId, platform: body.platform }, "Platform connected");

    return c.json({
      id: connection.id,
      platform: connection.platform,
      platform_username: connection.platform_username,
      connected: true,
    } satisfies ApiPlatformConnection);
  } catch (err: unknown) {
    log.error({ error: errMsg(err) }, "Failed to connect platform");
    return c.json({ error: "Failed to connect platform" }, 500);
  }
});

/**
 * GET /platforms/oauth/providers — List OAuth provider capabilities for the authenticated creator.
 */
platforms.get("/oauth/providers", requireCreatorAuth, async (c) => {
  return c.json(
    getPlatformOAuthProviders() satisfies ApiPlatformOAuthProvider[],
  );
});

/**
 * POST /platforms/oauth/:platform/start — Return an OAuth authorization URL for the authenticated creator.
 */
platforms.post("/oauth/:platform/start", requireCreatorAuth, async (c) => {
  const { creatorId, privyUserId } = getAuthContext(c);
  const platform = c.req.param("platform").toLowerCase();

  if (platform !== OAUTH_PLATFORM) {
    return c.json({ error: `Unsupported OAuth platform: ${platform}` }, 400);
  }

  try {
    const url = buildPlatformOAuthUrl({
      creatorId: creatorId!,
      privyUserId,
      platform,
    });

    return c.json({ url });
  } catch (err: unknown) {
    if (errMsg(err) === "YouTube OAuth is not configured") {
      const status = getYouTubeOAuthConfigStatus();
      return c.json(
        {
          error: "YouTube OAuth is not configured",
          missing: status.missing,
        },
        503,
      );
    }

    log.error(
      { error: errMsg(err), creatorId, platform },
      "Failed to start platform OAuth",
    );
    return c.json({ error: "Failed to start platform OAuth" }, 500);
  }
});

/**
 * GET /platforms/oauth/:platform/callback — Handle the provider callback and persist encrypted tokens.
 */
platforms.get("/oauth/:platform/callback", async (c) => {
  const platform = c.req.param("platform").toLowerCase();

  if (platform !== OAUTH_PLATFORM) {
    return redirectToOAuthResult(c, {
      platform,
      status: "error",
      error: "unsupported_platform",
    });
  }

  const code = c.req.query("code");
  const providerError = c.req.query("error");
  const state = c.req.query("state");

  let verifiedState;

  if (!state) {
    return redirectToOAuthResult(c, {
      platform,
      status: "error",
      error: "missing_code_or_state",
    });
  }

  try {
    verifiedState = verifyPlatformOAuthState({
      platform,
      state,
    });
  } catch (err: unknown) {
    log.warn(
      { error: errMsg(err), platform },
      "Platform OAuth state validation failed",
    );
    return redirectToOAuthResult(c, {
      platform,
      status: "error",
      error: "invalid_or_expired_state",
    });
  }

  if (providerError === "access_denied") {
    log.info(
      { platform, creatorId: verifiedState.creatorId },
      "Platform OAuth consent denied",
    );
    return redirectToOAuthResult(c, {
      platform,
      status: "error",
      error: "provider_access_denied",
    });
  }

  if (!code) {
    return redirectToOAuthResult(c, {
      platform,
      status: "error",
      error: "missing_code_or_state",
    });
  }

  let tokenSet;
  let identity;
  let callbackCreator;

  try {
    callbackCreator = await getCreatorById(verifiedState.creatorId);
  } catch (err: unknown) {
    log.error(
      { error: errMsg(err), creatorId: verifiedState.creatorId, platform },
      "Failed to load creator for platform OAuth callback",
    );
    return redirectToOAuthResult(c, {
      platform,
      status: "error",
      error: "creator_lookup_failed",
    });
  }

  if (
    !callbackCreator ||
    callbackCreator.privy_user_id !== verifiedState.privyUserId
  ) {
    log.warn(
      {
        creatorId: verifiedState.creatorId,
        privyUserId: verifiedState.privyUserId,
        callbackPrivyUserId: callbackCreator?.privy_user_id ?? null,
        platform,
      },
      "Platform OAuth callback creator binding mismatch",
    );
    return redirectToOAuthResult(c, {
      platform,
      status: "error",
      error: "creator_auth_mismatch",
    });
  }

  try {
    tokenSet = await exchangeYouTubeOAuthCode(code);
    identity = await fetchYouTubeChannelIdentity(tokenSet.accessToken);
  } catch (err: unknown) {
    if (errMsg(err) === "YouTube OAuth is not configured") {
      log.warn(
        { error: errMsg(err), platform },
        "Platform OAuth is not configured for callback",
      );
      return redirectToOAuthResult(c, {
        platform,
        status: "error",
        error: "oauth_not_configured",
      });
    }

    log.warn(
      { error: errMsg(err), platform },
      "Platform OAuth provider callback failed",
    );
    return redirectToOAuthResult(c, {
      platform,
      status: "error",
      error: "provider_callback_failed",
    });
  }

  try {
    await upsertConnection({
      creator_id: verifiedState.creatorId,
      platform,
      access_token: tokenSet.accessToken,
      refresh_token: tokenSet.refreshToken,
      platform_username: identity.handle ?? identity.title,
      platform_user_id: identity.channelId,
      metadata: {
        connection_method: "oauth",
      },
      expires_at: tokenSet.expiresAt,
    });
  } catch (err: unknown) {
    log.error(
      { error: errMsg(err), creatorId: verifiedState.creatorId, platform },
      "Failed to persist platform OAuth connection",
    );
    return redirectToOAuthResult(c, {
      platform,
      status: "error",
      error: "persistence_failed",
    });
  }

  log.info(
    {
      creatorId: verifiedState.creatorId,
      platform,
      platformUserId: identity.channelId,
    },
    "Platform OAuth connection stored",
  );

  return redirectToOAuthResult(c, {
    platform,
    status: "success",
  });
});

/**
 * DELETE /platforms/:platform — Disconnect a platform.
 */
platforms.delete("/:platform", requireCreatorAuth, async (c) => {
  const { creatorId } = getAuthContext(c);
  const platform = c.req.param("platform");

  const existing = await getConnection(creatorId!, platform);
  if (!existing) {
    return c.json({ error: "Connection not found" }, 404);
  }

  try {
    await deleteConnectionById(existing.id);
  } catch (err: unknown) {
    log.error(
      { error: errMsg(err), creatorId, platform },
      "Failed to disconnect platform",
    );
    return c.json({ error: "Failed to disconnect platform" }, 500);
  }

  log.info({ creatorId, platform }, "Platform disconnected");
  return c.json({ disconnected: true, platform });
});
