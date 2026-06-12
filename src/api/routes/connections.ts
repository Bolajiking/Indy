import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { env } from "../../config/env.js";
import {
  getRequiredCreatorId,
  requireCreatorAuth,
} from "../middleware/auth.js";
import {
  disconnectComposioToolkit,
  getComposioToolkits,
  initiateComposioConnection,
  isComposioEnabled,
  isComposioToolkit,
  listComposioConnections,
} from "../../integrations/composio.js";
import { syncCreatorConnectedIdentities } from "../../agent/connected-identities.js";
import type {
  ApiConnectionDisconnectResponse,
  ApiConnectionInitiateResponse,
  ApiConnectionsInfo,
} from "../contracts.js";

export const connections = new Hono();
connections.use("*", requireCreatorAuth);

function dashboardOrigin(): string {
  return env.DASHBOARD_APP_URL || "http://localhost:3001";
}

// Available connector toolkits + whether Composio is configured.
connections.get("/", async (c) => {
  const creatorId = getRequiredCreatorId(c);
  const toolkits = getComposioToolkits();
  const accounts = isComposioEnabled()
    ? await listComposioConnections(creatorId)
    : [];

  // Right after OAuth the dashboard polls this endpoint — capture the creator's
  // identity on freshly-connected apps (e.g. their YouTube channel id/@handle)
  // so the agent can act on their own account without asking. Fire-and-forget +
  // idempotent, so it never slows the response or repeats work.
  if (accounts.some((a) => a.connected)) {
    void syncCreatorConnectedIdentities(creatorId);
  }

  return c.json({
    enabled: isComposioEnabled(),
    toolkits,
    accounts,
  } satisfies ApiConnectionsInfo);
});

// Start an OAuth/connect flow for a toolkit; returns the redirect URL.
connections.post("/:toolkit/initiate", async (c) => {
  const creatorId = getRequiredCreatorId(c);
  const toolkit = c.req.param("toolkit").toLowerCase();

  if (!isComposioEnabled()) {
    throw new HTTPException(503, {
      message: "Connections are not configured (Composio is disabled).",
    });
  }
  if (!isComposioToolkit(toolkit)) {
    throw new HTTPException(404, {
      message: `"${toolkit}" is not an available connection.`,
    });
  }

  // Chat-initiated connects return straight to the chat (which shows the
  // success state inline); settings-initiated ones return to Settings.
  const returnTo = c.req.query("return") === "chat" ? "chat" : "settings";
  const callbackPath =
    returnTo === "chat" ? "/dashboard" : "/dashboard/settings";
  const callbackUrl = `${dashboardOrigin()}${callbackPath}?connected=${encodeURIComponent(toolkit)}`;

  try {
    const { redirectUrl } = await initiateComposioConnection(
      creatorId,
      toolkit,
      callbackUrl,
    );
    return c.json({ redirectUrl } satisfies ApiConnectionInitiateResponse);
  } catch (error) {
    throw new HTTPException(502, {
      message:
        error instanceof Error
          ? error.message
          : "Could not start the connection.",
    });
  }
});

// Disconnect a toolkit (removes the creator's connected account(s) for it).
connections.delete("/:toolkit", async (c) => {
  const creatorId = getRequiredCreatorId(c);
  const toolkit = c.req.param("toolkit").toLowerCase();

  if (!isComposioEnabled()) {
    throw new HTTPException(503, {
      message: "Connections are not configured (Composio is disabled).",
    });
  }

  try {
    const disconnected = await disconnectComposioToolkit(creatorId, toolkit);
    return c.json({ disconnected } satisfies ApiConnectionDisconnectResponse);
  } catch (error) {
    throw new HTTPException(502, {
      message: error instanceof Error ? error.message : "Could not disconnect.",
    });
  }
});
