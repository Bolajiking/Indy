import { Hono } from "hono";
import {
  createCreator,
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

const log = pino({ name: "api:auth" });

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export const auth = new Hono();
auth.use("*", requirePrivyAuth);

function getOnboardingState(
  creator: {
    wallet_id?: string | null;
    wallet_address?: string | null;
    settings?: Record<string, unknown> | null;
  } | null
) {
  if (!creator) {
    return {
      status: "unregistered",
      walletProvisioned: false,
    } as const;
  }

  return getWalletOnboardingMetadata(creator);
}

function creatorServiceUnavailable(
  c: { json: (body: { error: string }, status: number) => Response },
  error: unknown
) {
  log.warn({ error }, "Creator service is temporarily unavailable");
  return c.json({ error: CREATOR_SERVICE_UNAVAILABLE_MESSAGE }, 503);
}

auth.post("/register", async (c) => {
  const { privyUserId, creatorId, creatorResolutionError } = getAuthContext(c);
  const { displayName, niche } = await c.req.json<{
    displayName: string;
    niche?: string;
  }>();

  if (!displayName?.trim()) {
    return c.json({ error: "displayName is required" }, 400);
  }

  if (creatorResolutionError) {
    return creatorServiceUnavailable(c, creatorResolutionError);
  }

  try {
    let existingCreator = creatorId ? await getCreatorById(creatorId) : null;
    if (!existingCreator) {
      existingCreator = await getCreatorByPrivyUserId(privyUserId);
    }

    if (existingCreator) {
      let creator = existingCreator;
      if (!creator.wallet_id || !creator.wallet_address) {
        const provisioning = await ensureCreatorWalletProvisioning(creator.id, {
          force: false,
          source: "dashboard_register",
        });
        creator =
          provisioning.creator ??
          (await getCreatorById(existingCreator.id)) ??
          existingCreator;
      }

      return c.json(
        {
          creator,
          isNew: false,
          onboarding: getOnboardingState(creator),
        },
        200
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
          let hydratedCreator = racedCreator;
          if (!hydratedCreator.wallet_id || !hydratedCreator.wallet_address) {
            const provisioning = await ensureCreatorWalletProvisioning(racedCreator.id, {
              force: false,
              source: "dashboard_register",
            });
            hydratedCreator =
              provisioning.creator ??
              (await getCreatorById(racedCreator.id)) ??
              racedCreator;
          }

          return c.json(
            {
              creator: hydratedCreator,
              isNew: false,
              onboarding: getOnboardingState(hydratedCreator),
            },
            200
          );
        }
      }

      throw error;
    }

    const provisioning = await ensureCreatorWalletProvisioning(creator.id, {
      force: true,
      source: "dashboard_register",
    });
    const updatedCreator =
      provisioning.creator ?? (await getCreatorById(creator.id)) ?? creator;

    log.info({ creatorId: creator.id }, "Creator registered via dashboard");
    return c.json(
      {
        creator: updatedCreator,
        isNew: true,
        onboarding: getOnboardingState(updatedCreator),
      },
      201
    );
  } catch (err: unknown) {
    if (isDatabaseServiceUnavailableError(err)) {
      return creatorServiceUnavailable(c, err);
    }

    log.error({ error: errMsg(err) }, "Creator registration failed");
    return c.json({ error: "Registration failed" }, 500);
  }
});

auth.get("/me", async (c) => {
  const { creatorId, creatorResolutionError, privyUserId } = getAuthContext(c);
  if (creatorResolutionError) {
    return creatorServiceUnavailable(c, creatorResolutionError);
  }

  try {
    let creator =
      (creatorId ? await getCreatorById(creatorId) : null) ??
      (await getCreatorByPrivyUserId(privyUserId));

    if (creator && (!creator.wallet_id || !creator.wallet_address)) {
      const provisioning = await ensureCreatorWalletProvisioning(creator.id, {
        force: false,
        source: "dashboard_session_sync",
      });
      creator = provisioning.creator ?? (await getCreatorById(creator.id)) ?? creator;
    }

    return c.json({
      creator,
      onboarding: getOnboardingState(creator),
    });
  } catch (err: unknown) {
    if (isDatabaseServiceUnavailableError(err)) {
      return creatorServiceUnavailable(c, err);
    }

    log.error({ error: errMsg(err) }, "Creator session lookup failed");
    return c.json({ error: "Unable to load creator session" }, 500);
  }
});

auth.patch("/me", async (c) => {
  const { privyUserId, creatorId, creatorResolutionError } = getAuthContext(c);
  const body = await c.req.json<{
    displayName?: string;
    niche?: string;
    settings?: Record<string, unknown>;
  }>();

  if (creatorResolutionError) {
    return creatorServiceUnavailable(c, creatorResolutionError);
  }

  const normalizedDisplayName = body.displayName?.trim();
  if (body.displayName !== undefined && !normalizedDisplayName) {
    return c.json({ error: "displayName cannot be empty" }, 400);
  }

  try {
    const creator =
      (creatorId ? await getCreatorById(creatorId) : null) ??
      (await getCreatorByPrivyUserId(privyUserId));
    if (!creator) {
      return c.json({ error: "Creator not found" }, 404);
    }

    const updates: Record<string, unknown> = {};
    if (body.displayName !== undefined) updates.display_name = normalizedDisplayName;
    if (body.niche !== undefined) updates.niche = body.niche.trim() || null;
    if (body.settings) {
      updates.settings = {
        ...(creator.settings ?? {}),
        ...body.settings,
      };
    }

    const updatedCreator = await updateCreator(creator.id, updates as any);
    return c.json({
      creator: updatedCreator,
      onboarding: getOnboardingState(updatedCreator),
    });
  } catch (err: unknown) {
    if (isDatabaseServiceUnavailableError(err)) {
      return creatorServiceUnavailable(c, err);
    }

    log.error({ error: errMsg(err) }, "Creator update failed");
    return c.json({ error: "Update failed" }, 500);
  }
});

auth.post("/onboarding", async (c) => {
  const { creatorId, creatorResolutionError } = getAuthContext(c);

  if (creatorResolutionError) {
    return creatorServiceUnavailable(c, creatorResolutionError);
  }

  if (!creatorId) {
    return c.json({ error: "Creator not found — complete registration first" }, 400);
  }

  try {
    const body = await c.req.json<{
      platforms?: string[];
      followerRange?: string;
      currentRateUsd?: number;
      monthlyTargetUsd?: number;
      goals?: string[];
      experienceLevel?: string;
    }>();

    const memoryEntries: Array<{ key: string; content: string }> = [];
    if (body.platforms?.length) {
      memoryEntries.push({ key: "platforms", content: `Active on: ${body.platforms.join(", ")}` });
    }
    if (body.followerRange) {
      memoryEntries.push({ key: "follower_range", content: `Follower range: ${body.followerRange}` });
    }
    if (body.currentRateUsd) {
      memoryEntries.push({ key: "current_rate_usd", content: `Current rate: $${body.currentRateUsd} per sponsored post` });
    }
    if (body.monthlyTargetUsd) {
      memoryEntries.push({ key: "monthly_target_usd", content: `Monthly income target: $${body.monthlyTargetUsd}` });
    }
    if (body.goals?.length) {
      memoryEntries.push({ key: "goals", content: `Creator goals: ${body.goals.join(", ")}` });
    }
    if (body.experienceLevel) {
      memoryEntries.push({ key: "experience_level", content: `Experience level: ${body.experienceLevel}` });
    }

    await Promise.all(
      memoryEntries.map((entry) =>
        upsertCreatorMemory(creatorId, {
          memory_type: "context",
          skill: null,
          key: `onboarding.${entry.key}`,
          content: entry.content,
          confidence: 1.0,
        })
      )
    );

    const creator = await getCreatorById(creatorId);
    const updatedCreator = await updateCreator(creatorId, {
      settings: { ...(creator?.settings ?? {}), onboarding_complete: true },
    } as any);

    log.info({ creatorId }, "Creator onboarding context saved");
    return c.json({
      creator: updatedCreator,
      onboarding: getOnboardingState(updatedCreator),
    });
  } catch (err: unknown) {
    if (isDatabaseServiceUnavailableError(err)) {
      return creatorServiceUnavailable(c, err);
    }
    log.error({ error: errMsg(err) }, "Onboarding context save failed");
    return c.json({ error: "Failed to save onboarding context" }, 500);
  }
});

auth.post("/me/wallet/retry", async (c) => {
  const { privyUserId, creatorId, creatorResolutionError } = getAuthContext(c);

  if (creatorResolutionError) {
    return creatorServiceUnavailable(c, creatorResolutionError);
  }

  try {
    const creator =
      (creatorId ? await getCreatorById(creatorId) : null) ??
      (await getCreatorByPrivyUserId(privyUserId));
    if (!creator) {
      return c.json({ error: "Creator not found" }, 404);
    }

    if (creator.wallet_id && creator.wallet_address) {
      return c.json(
        {
          creator,
          onboarding: getOnboardingState(creator),
        },
        200
      );
    }

    const provisioning = await ensureCreatorWalletProvisioning(creator.id, {
      force: true,
      source: "dashboard_manual_retry",
    });
    const updatedCreator =
      provisioning.creator ?? (await getCreatorById(creator.id)) ?? creator;

    return c.json(
      {
        creator: updatedCreator,
        onboarding: getOnboardingState(updatedCreator),
      },
      202
    );
  } catch (err: unknown) {
    if (isDatabaseServiceUnavailableError(err)) {
      return creatorServiceUnavailable(c, err);
    }

    log.error({ error: errMsg(err) }, "Wallet retry request failed");
    return c.json({ error: "Wallet retry failed" }, 500);
  }
});
