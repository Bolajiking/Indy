import { Hono } from "hono";
import {
  createCreator,
  type Creator,
  getCreatorById,
  getCreatorByPrivyUserId,
  updateCreator,
} from "../../db/queries/creators.js";
import pino from "pino";
import { getAuthContext, requirePrivyAuth } from "../middleware/auth.js";
import {
  CREATOR_SERVICE_UNAVAILABLE_MESSAGE,
  isDatabaseServiceUnavailableError,
  isDatabaseUniqueViolationError,
} from "../../db/errors.js";
import {
  ensureCreatorWalletProvisioning,
  getWalletOnboardingMetadata,
} from "../../wallet/provisioning.js";
import { upsertCreatorMemory } from "../../db/queries/creator-memories.js";
import { isJsonObject, type JsonObject } from "../../db/json.js";
import { errMsg } from "../../lib/errors.js";
import type {
  ApiAuthProfileResponse,
  ApiOnboardingContextInput,
  ApiOnboardingState,
  ApiProfileUpdateInput,
  ApiRegistrationInput,
} from "../contracts.js";

const log = pino({ name: "api:auth" });

export const auth = new Hono();
auth.use("*", requirePrivyAuth);

function getOnboardingState(
  creator: {
    wallet_id?: string | null;
    wallet_address?: string | null;
    settings?: JsonObject | null;
  } | null,
): ApiOnboardingState {
  if (!creator) {
    return {
      status: "unregistered",
      walletProvisioned: false,
    };
  }

  return getWalletOnboardingMetadata(creator);
}

function creatorServiceUnavailable(
  c: { json: (body: { error: string }, status: number) => Response },
  error: unknown,
) {
  log.warn({ error }, "Creator service is temporarily unavailable");
  return c.json({ error: CREATOR_SERVICE_UNAVAILABLE_MESSAGE }, 503);
}

/**
 * Shared catch handler for auth routes: 503 when the creator service is down,
 * otherwise log and return a 500 with the route's public error message.
 */
function handleAuthRouteError(
  c: { json: (body: { error: string }, status: number) => Response },
  err: unknown,
  logMessage: string,
  publicMessage: string,
) {
  if (isDatabaseServiceUnavailableError(err)) {
    return creatorServiceUnavailable(c, err);
  }

  log.error({ error: errMsg(err) }, logMessage);
  return c.json({ error: publicMessage }, 500);
}

/** Resolve the authed creator by creator id, falling back to the Privy user id. */
async function findAuthedCreator(
  creatorId: string | null | undefined,
  privyUserId: string,
): Promise<Creator | null> {
  return (
    (creatorId ? await getCreatorById(creatorId) : null) ??
    (await getCreatorByPrivyUserId(privyUserId))
  );
}

async function hydrateCreatorWallet(
  creator: Creator,
  options: Parameters<typeof ensureCreatorWalletProvisioning>[1],
): Promise<Creator> {
  if (!options?.force && creator.wallet_id && creator.wallet_address) {
    return creator;
  }

  const provisioning = await ensureCreatorWalletProvisioning(
    creator.id,
    options,
  );
  return provisioning.creator ?? (await getCreatorById(creator.id)) ?? creator;
}

auth.post("/register", async (c) => {
  const { privyUserId, creatorId, creatorResolutionError } = getAuthContext(c);
  const { displayName, niche } = await c.req.json<ApiRegistrationInput>();

  if (!displayName?.trim()) {
    return c.json({ error: "displayName is required" }, 400);
  }

  if (creatorResolutionError) {
    return creatorServiceUnavailable(c, creatorResolutionError);
  }

  try {
    const existingCreator = await findAuthedCreator(creatorId, privyUserId);

    if (existingCreator) {
      const creator = await hydrateCreatorWallet(existingCreator, {
        force: false,
        source: "dashboard_register",
      });

      return c.json(
        {
          creator,
          isNew: false,
          onboarding: getOnboardingState(creator),
        } satisfies ApiAuthProfileResponse,
        200,
      );
    }

    let creator;
    try {
      creator = await createCreator({
        privy_user_id: privyUserId,
        display_name: displayName.trim(),
        niche: niche?.trim() || undefined,
        settings: { onboarding_status: "wallet_pending" },
      });
    } catch (error) {
      if (isDatabaseUniqueViolationError(error)) {
        const racedCreator = await getCreatorByPrivyUserId(privyUserId);
        if (racedCreator) {
          const hydratedCreator = await hydrateCreatorWallet(racedCreator, {
            force: false,
            source: "dashboard_register",
          });

          return c.json(
            {
              creator: hydratedCreator,
              isNew: false,
              onboarding: getOnboardingState(hydratedCreator),
            } satisfies ApiAuthProfileResponse,
            200,
          );
        }
      }

      throw error;
    }

    const updatedCreator = await hydrateCreatorWallet(creator, {
      force: true,
      source: "dashboard_register",
    });

    log.info({ creatorId: creator.id }, "Creator registered via dashboard");
    return c.json(
      {
        creator: updatedCreator,
        isNew: true,
        onboarding: getOnboardingState(updatedCreator),
      } satisfies ApiAuthProfileResponse,
      201,
    );
  } catch (err: unknown) {
    return handleAuthRouteError(
      c,
      err,
      "Creator registration failed",
      "Registration failed",
    );
  }
});

auth.get("/me", async (c) => {
  const { creatorId, creatorResolutionError, privyUserId } = getAuthContext(c);
  if (creatorResolutionError) {
    return creatorServiceUnavailable(c, creatorResolutionError);
  }

  try {
    let creator = await findAuthedCreator(creatorId, privyUserId);

    if (creator) {
      creator = await hydrateCreatorWallet(creator, {
        force: false,
        source: "dashboard_session_sync",
      });
    }

    return c.json({
      creator,
      onboarding: getOnboardingState(creator),
    } satisfies ApiAuthProfileResponse);
  } catch (err: unknown) {
    return handleAuthRouteError(
      c,
      err,
      "Creator session lookup failed",
      "Unable to load creator session",
    );
  }
});

auth.patch("/me", async (c) => {
  const { privyUserId, creatorId, creatorResolutionError } = getAuthContext(c);
  const body = await c.req.json<ApiProfileUpdateInput>();

  if (creatorResolutionError) {
    return creatorServiceUnavailable(c, creatorResolutionError);
  }

  const normalizedDisplayName = body.displayName?.trim();
  if (body.displayName !== undefined && !normalizedDisplayName) {
    return c.json({ error: "displayName cannot be empty" }, 400);
  }

  try {
    const creator = await findAuthedCreator(creatorId, privyUserId);
    if (!creator) {
      return c.json({ error: "Creator not found" }, 404);
    }

    const updates: Partial<Creator> = {};
    if (body.displayName !== undefined)
      updates.display_name = normalizedDisplayName;
    if (body.niche !== undefined) updates.niche = body.niche.trim() || null;
    if (isJsonObject(body.settings)) {
      updates.settings = {
        ...(creator.settings ?? {}),
        ...body.settings,
      };
    }

    const updatedCreator = await updateCreator(creator.id, updates);
    return c.json({
      creator: updatedCreator,
      onboarding: getOnboardingState(updatedCreator),
    } satisfies ApiAuthProfileResponse);
  } catch (err: unknown) {
    return handleAuthRouteError(
      c,
      err,
      "Creator update failed",
      "Update failed",
    );
  }
});

auth.post("/onboarding", async (c) => {
  const { creatorId, creatorResolutionError } = getAuthContext(c);

  if (creatorResolutionError) {
    return creatorServiceUnavailable(c, creatorResolutionError);
  }

  if (!creatorId) {
    return c.json(
      { error: "Creator not found — complete registration first" },
      400,
    );
  }

  try {
    const body = await c.req.json<Partial<ApiOnboardingContextInput>>();

    const memoryEntries: Array<{ key: string; content: string }> = [];
    if (body.platforms?.length) {
      memoryEntries.push({
        key: "platforms",
        content: `Active on: ${body.platforms.join(", ")}`,
      });
    }
    if (body.followerRange) {
      memoryEntries.push({
        key: "follower_range",
        content: `Follower range: ${body.followerRange}`,
      });
    }
    if (body.currentRateUsd) {
      memoryEntries.push({
        key: "current_rate_usd",
        content: `Current rate: $${body.currentRateUsd} per sponsored post`,
      });
    }
    if (body.monthlyTargetUsd) {
      memoryEntries.push({
        key: "monthly_target_usd",
        content: `Monthly income target: $${body.monthlyTargetUsd}`,
      });
    }
    if (body.goals?.length) {
      memoryEntries.push({
        key: "goals",
        content: `Creator goals: ${body.goals.join(", ")}`,
      });
    }
    if (body.experienceLevel) {
      memoryEntries.push({
        key: "experience_level",
        content: `Experience level: ${body.experienceLevel}`,
      });
    }

    await Promise.all(
      memoryEntries.map((entry) =>
        upsertCreatorMemory(creatorId, {
          memory_type: "context",
          skill: null,
          key: `onboarding.${entry.key}`,
          content: entry.content,
          confidence: 1.0,
        }),
      ),
    );

    const creator = await getCreatorById(creatorId);
    const updatedCreator = await updateCreator(creatorId, {
      settings: { ...(creator?.settings ?? {}), onboarding_complete: true },
    });

    log.info({ creatorId }, "Creator onboarding context saved");
    return c.json({
      creator: updatedCreator,
      onboarding: getOnboardingState(updatedCreator),
    } satisfies ApiAuthProfileResponse);
  } catch (err: unknown) {
    return handleAuthRouteError(
      c,
      err,
      "Onboarding context save failed",
      "Failed to save onboarding context",
    );
  }
});

auth.post("/me/wallet/retry", async (c) => {
  const { privyUserId, creatorId, creatorResolutionError } = getAuthContext(c);

  if (creatorResolutionError) {
    return creatorServiceUnavailable(c, creatorResolutionError);
  }

  try {
    const creator = await findAuthedCreator(creatorId, privyUserId);
    if (!creator) {
      return c.json({ error: "Creator not found" }, 404);
    }

    if (creator.wallet_id && creator.wallet_address) {
      return c.json(
        {
          creator,
          onboarding: getOnboardingState(creator),
        } satisfies ApiAuthProfileResponse,
        200,
      );
    }

    const updatedCreator = await hydrateCreatorWallet(creator, {
      force: true,
      source: "dashboard_manual_retry",
    });

    return c.json(
      {
        creator: updatedCreator,
        onboarding: getOnboardingState(updatedCreator),
      } satisfies ApiAuthProfileResponse,
      202,
    );
  } catch (err: unknown) {
    return handleAuthRouteError(
      c,
      err,
      "Wallet retry request failed",
      "Wallet retry failed",
    );
  }
});
