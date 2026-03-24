import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { getAuthContext, requireCreatorAuth } from "../middleware/auth.js";
import { issueMessagingLinkSession } from "../../messaging/linking.js";
import { type MessagingPlatform } from "../../messaging/link-tokens.js";

export const messaging = new Hono();
messaging.use("*", requireCreatorAuth);

function parsePlatform(platform: string): MessagingPlatform {
  if (platform === "telegram" || platform === "whatsapp") {
    return platform;
  }

  throw new HTTPException(400, {
    message: "Unsupported messaging platform",
  });
}

messaging.post("/:platform", async (c) => {
  const { creatorId } = getAuthContext(c);
  const platform = parsePlatform(c.req.param("platform"));

  return c.json(
    await issueMessagingLinkSession({ creatorId: creatorId!, platform })
  );
});
