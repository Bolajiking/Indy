import crypto from "node:crypto";
import {
  findCreatorByTelegram,
  findCreatorByWhatsApp,
  getCreatorById,
  updateCreator,
  type Creator,
} from "../db/queries/creators.js";
import {
  consumeMessagingLinkSession,
  createMessagingLinkSession,
} from "../db/queries/messaging-link-sessions.js";
import {
  buildMessagingLinkSession,
  createMessagingLinkToken,
  MESSAGING_LINK_TOKEN_TTL_SECONDS,
  verifyMessagingLinkToken,
} from "./link-tokens.js";
import type { MessagingPlatform } from "./types.js";

export type MessagingLinkResult =
  | { status: "linked"; creator: Creator }
  | { status: "already_linked"; creator: Creator }
  | { status: "invalid_or_expired" }
  | { status: "channel_in_use"; ownerCreatorId: string };

export async function issueMessagingLinkSession(input: {
  creatorId: string;
  platform: MessagingPlatform;
}) {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(
    Date.now() + MESSAGING_LINK_TOKEN_TTL_SECONDS * 1000,
  );
  const { token, tokenHash } = createMessagingLinkToken({ sessionId });

  await createMessagingLinkSession({
    id: sessionId,
    creatorId: input.creatorId,
    platform: input.platform,
    tokenHash,
    expiresAt: expiresAt.toISOString(),
  });

  return buildMessagingLinkSession({
    platform: input.platform,
    token,
    expiresAt,
  });
}

export async function connectMessagingChannelFromToken(input: {
  platform: MessagingPlatform;
  token: string;
  platformUserId: string;
}): Promise<MessagingLinkResult> {
  const verified = verifyMessagingLinkToken(input.token);
  if (!verified) {
    return { status: "invalid_or_expired" };
  }

  const session = await consumeMessagingLinkSession(
    verified.sessionId,
    input.platform,
    verified.tokenHash,
    input.platformUserId,
  );
  if (!session) {
    return { status: "invalid_or_expired" };
  }

  const creator = await getCreatorById(session.creator_id);
  if (!creator) {
    return { status: "invalid_or_expired" };
  }

  const existingOwner =
    input.platform === "telegram"
      ? await findCreatorByTelegram(input.platformUserId)
      : await findCreatorByWhatsApp(input.platformUserId);

  if (existingOwner && existingOwner.id !== creator.id) {
    return {
      status: "channel_in_use",
      ownerCreatorId: existingOwner.id,
    };
  }

  if (
    (input.platform === "telegram" &&
      creator.telegram_chat_id === input.platformUserId) ||
    (input.platform === "whatsapp" &&
      creator.whatsapp_phone === input.platformUserId)
  ) {
    return { status: "already_linked", creator };
  }

  const updatedCreator = await updateCreator(creator.id, {
    telegram_chat_id:
      input.platform === "telegram"
        ? input.platformUserId
        : creator.telegram_chat_id,
    whatsapp_phone:
      input.platform === "whatsapp"
        ? input.platformUserId
        : creator.whatsapp_phone,
  });

  return { status: "linked", creator: updatedCreator };
}
