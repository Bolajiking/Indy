import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { getAuthContext, requireCreatorAuth } from "../middleware/auth.js";
import { issueMessagingLinkSession } from "../../messaging/linking.js";
import {
  isMessagingPlatform,
  type MessagingPlatform,
} from "../../messaging/types.js";
import type { ApiMessagingLink } from "../contracts.js";

export const messaging = new Hono();
messaging.use("*", requireCreatorAuth);

function parsePlatform(platform: string): MessagingPlatform {
  if (isMessagingPlatform(platform)) {
    return platform;
  }

  throw new HTTPException(400, {
    message: "Unsupported messaging platform",
  });
}

messaging.post("/:platform", async (c) => {
  const { creatorId } = getAuthContext(c);
  const platform = parsePlatform(c.req.param("platform"));

  const link = await issueMessagingLinkSession({
    creatorId: creatorId!,
    platform,
  });
  return c.json(link satisfies ApiMessagingLink);
});
