/**
 * Capture & persist a creator's identity on their connected apps (e.g. their
 * YouTube channel id / @handle / title) so the agent can act on the creator's
 * OWN account without asking them for it.
 *
 * Idempotent and non-blocking: skips apps already captured, never throws. Called
 * fire-and-forget right after a connection completes (connections route) and as
 * a safety net on each message. Structured to extend to other toolkits.
 */

import pino from "#logger";
import { getCreatorById, updateCreator } from "../db/queries/creators.js";
import { isJsonObject, type JsonObject } from "../db/json.js";
import {
  executeComposioToolBySlug,
  isComposioEnabled,
  listComposioConnections,
} from "../integrations/composio.js";

const log = pino({ name: "agent:connected-identities" });

export interface YoutubeIdentity {
  channelId: string;
  title?: string;
  handle?: string;
}

function readIdentities(settings: JsonObject | null | undefined): JsonObject {
  const ci = settings?.connected_identities;
  return isJsonObject(ci) ? ci : {};
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

async function captureYoutube(
  creatorId: string,
): Promise<YoutubeIdentity | null> {
  try {
    const out = await executeComposioToolBySlug(
      creatorId,
      "YOUTUBE_GET_CHANNEL_STATISTICS",
      { mine: true, part: "snippet,statistics" },
    );
    if (!out.success) return null;
    const data = out.data as {
      items?: Array<Record<string, unknown>>;
      channels?: Array<Record<string, unknown>>;
    };
    const item = data?.items?.[0] ?? data?.channels?.[0];
    const id = str(item?.id);
    if (!item || !id) return null;
    const snippet = isJsonObject(item.snippet) ? item.snippet : {};
    return {
      channelId: id,
      title: str(snippet.title),
      handle: str(snippet.customUrl),
    };
  } catch (err) {
    log.warn({ err, creatorId }, "YouTube identity capture failed");
    return null;
  }
}

/**
 * Capture identities for whatever the creator has connected. Idempotent: a
 * toolkit is only probed once (success stores the identity; a miss stores a
 * `checkedAt` sentinel so we don't re-probe channel-less accounts every turn).
 */
export async function syncCreatorConnectedIdentities(
  creatorId: string,
): Promise<void> {
  if (!isComposioEnabled()) return;
  try {
    const creator = await getCreatorById(creatorId);
    if (!creator) return;
    const identities = readIdentities(creator.settings);

    const conns = await listComposioConnections(creatorId);
    const ytConnected = conns.some(
      (c) => c.toolkit === "youtube" && c.connected,
    );

    // YouTube: probe once while connected and not already recorded.
    if (ytConnected && identities.youtube === undefined) {
      const yt = await captureYoutube(creatorId);
      const record: JsonObject = yt
        ? {
            channelId: yt.channelId,
            ...(yt.title ? { title: yt.title } : {}),
            ...(yt.handle ? { handle: yt.handle } : {}),
          }
        : { checkedAt: new Date().toISOString() };

      const baseSettings = isJsonObject(creator.settings)
        ? creator.settings
        : {};
      await updateCreator(creatorId, {
        settings: {
          ...baseSettings,
          connected_identities: { ...identities, youtube: record },
        },
      });
      if (yt) {
        log.info(
          { creatorId, channelId: yt.channelId, handle: yt.handle },
          "Captured YouTube identity",
        );
      }
    }
  } catch (err) {
    log.warn({ err, creatorId }, "syncCreatorConnectedIdentities failed");
  }
}

/** Read stored connected identities for prompt context (pure; no I/O). */
export function getStoredYoutubeIdentity(
  settings: JsonObject | null | undefined,
): YoutubeIdentity | undefined {
  const yt = readIdentities(settings).youtube;
  if (!isJsonObject(yt)) return undefined;
  const channelId = str(yt.channelId);
  if (!channelId) return undefined;
  return {
    channelId,
    title: str(yt.title),
    handle: str(yt.handle),
  };
}
