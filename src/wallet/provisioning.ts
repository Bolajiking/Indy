import pino from "pino";
import {
  getCreatorById,
  updateCreator,
  type Creator,
} from "../db/queries/creators.js";
import { createWalletForCreator } from "./privy.js";

const log = pino({ name: "wallet:provisioning" });

const WALLET_PROVISIONING_RETRY_INTERVAL_MS = 60_000;
const inFlightProvisioning = new Map<
  string,
  {
    started: Promise<Creator>;
    completed: Promise<void>;
  }
>();

interface CreatorWithWalletSettings {
  wallet_id?: string | null;
  wallet_address?: string | null;
  settings?: Record<string, unknown> | null;
}

export interface WalletOnboardingMetadata {
  status: string;
  walletProvisioned: boolean;
  walletProvisioningInProgress: boolean;
  walletProvisioningAttempts: number;
  walletProvisioningLastError: string | null;
  onboardingComplete: boolean;
}

export interface EnsureWalletProvisioningOptions {
  force?: boolean;
  awaitCompletion?: boolean;
  source?: string;
}

export interface EnsureWalletProvisioningResult {
  started: boolean;
  creator: Creator | null;
  reason:
    | "already_provisioned"
    | "already_in_progress"
    | "cooldown"
    | "creator_not_found"
    | "started";
}

function readProvisioningAttempts(settings: Record<string, unknown> | null | undefined): number {
  const attempts = settings?.wallet_provisioning_attempts;
  return typeof attempts === "number" && Number.isFinite(attempts) ? attempts : 0;
}

function readLastAttemptAt(settings: Record<string, unknown> | null | undefined): number | null {
  const raw = settings?.wallet_provisioning_last_attempt_at;
  if (typeof raw !== "string" || raw.length === 0) {
    return null;
  }

  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeProvisioningError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "wallet_provisioning_failed";
}

function mergeWalletSettings(
  creator: CreatorWithWalletSettings,
  updates: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...(creator.settings ?? {}),
    ...updates,
  };
}

export function getWalletOnboardingMetadata(
  creator: CreatorWithWalletSettings | null
): WalletOnboardingMetadata {
  if (!creator) {
    return {
      status: "unregistered",
      walletProvisioned: false,
      walletProvisioningInProgress: false,
      walletProvisioningAttempts: 0,
      walletProvisioningLastError: null,
      onboardingComplete: false,
    };
  }

  if (creator.wallet_id && creator.wallet_address) {
    return {
      status: "active",
      walletProvisioned: true,
      walletProvisioningInProgress: false,
      walletProvisioningAttempts: readProvisioningAttempts(creator.settings),
      walletProvisioningLastError: null,
      onboardingComplete: creator.settings?.onboarding_complete === true,
    };
  }

  return {
    status:
      typeof creator.settings?.onboarding_status === "string"
        ? creator.settings.onboarding_status
        : "wallet_pending",
    walletProvisioned: false,
    walletProvisioningInProgress:
      creator.settings?.wallet_provisioning_in_progress === true,
    walletProvisioningAttempts: readProvisioningAttempts(creator.settings),
    walletProvisioningLastError:
      typeof creator.settings?.onboarding_error === "string"
        ? creator.settings.onboarding_error
        : null,
    onboardingComplete: creator.settings?.onboarding_complete === true,
  };
}

async function markProvisioningStarted(
  creator: Creator,
  source: string
): Promise<Creator> {
  return updateCreator(creator.id, {
    settings: mergeWalletSettings(creator, {
      onboarding_status: "wallet_pending",
      wallet_provisioning_in_progress: true,
      wallet_provisioning_attempts: readProvisioningAttempts(creator.settings) + 1,
      wallet_provisioning_last_attempt_at: new Date().toISOString(),
      wallet_provisioning_source: source,
      onboarding_error: null,
    }),
  } as Partial<Creator>);
}

async function markProvisioningSucceeded(creatorId: string): Promise<void> {
  const creator = await getCreatorById(creatorId);
  if (!creator) {
    return;
  }

  await updateCreator(creatorId, {
    settings: mergeWalletSettings(creator, {
      onboarding_status: "active",
      wallet_provisioning_in_progress: false,
      onboarding_error: null,
      wallet_provisioned_at: new Date().toISOString(),
    }),
  } as Partial<Creator>);
}

async function markProvisioningFailed(
  creatorId: string,
  error: unknown
): Promise<void> {
  const creator = await getCreatorById(creatorId);
  if (!creator) {
    return;
  }

  await updateCreator(creatorId, {
    settings: mergeWalletSettings(creator, {
      onboarding_status: "wallet_pending",
      wallet_provisioning_in_progress: false,
      onboarding_error: normalizeProvisioningError(error),
      wallet_provisioning_last_error_at: new Date().toISOString(),
    }),
  } as Partial<Creator>);
}

async function runProvisioningAttempt(creatorId: string): Promise<void> {
  try {
    const wallet = await createWalletForCreator(creatorId);
    log.info({ creatorId, walletId: wallet.walletId }, "Creator wallet provisioned");
    await markProvisioningSucceeded(creatorId);
  } catch (error) {
    log.warn(
      {
        creatorId,
        error: normalizeProvisioningError(error),
        cause:
          error instanceof Error && error.cause instanceof Error
            ? error.cause.message
            : error instanceof Error && error.cause
              ? String(error.cause)
              : undefined,
      },
      "Creator wallet provisioning failed"
    );
    await markProvisioningFailed(creatorId, error);
  }
}

export async function ensureCreatorWalletProvisioning(
  creatorId: string,
  options: EnsureWalletProvisioningOptions = {}
): Promise<EnsureWalletProvisioningResult> {
  const creator = await getCreatorById(creatorId);
  if (!creator) {
    return {
      started: false,
      creator: null,
      reason: "creator_not_found",
    };
  }

  if (creator.wallet_id && creator.wallet_address) {
    return {
      started: false,
      creator,
      reason: "already_provisioned",
    };
  }

  const onboarding = getWalletOnboardingMetadata(creator);
  const lastAttemptAt = readLastAttemptAt(creator.settings);
  const withinRetryWindow =
    lastAttemptAt !== null &&
    Date.now() - lastAttemptAt < WALLET_PROVISIONING_RETRY_INTERVAL_MS;

  const inFlight = inFlightProvisioning.get(creatorId);
  if (inFlight) {
    if (options.awaitCompletion) {
      await inFlight.completed;
      return {
        started: false,
        creator: await getCreatorById(creatorId),
        reason: "already_in_progress",
      };
    }

    return {
      started: false,
      creator,
      reason: "already_in_progress",
    };
  }

  if (
    onboarding.walletProvisioningInProgress &&
    withinRetryWindow &&
    !options.force
  ) {
    return {
      started: false,
      creator,
      reason: "already_in_progress",
    };
  }

  if (
    !options.force &&
    withinRetryWindow
  ) {
    return {
      started: false,
      creator,
      reason: "cooldown",
    };
  }

  let resolveStarted!: (creator: Creator) => void;
  let rejectStarted!: (error: unknown) => void;

  const started = new Promise<Creator>((resolve, reject) => {
    resolveStarted = resolve;
    rejectStarted = reject;
  });

  const completed = (async () => {
    try {
      const updatedCreator = await markProvisioningStarted(
        creator,
        options.source ?? "wallet_provisioning"
      );
      resolveStarted(updatedCreator);
      await runProvisioningAttempt(creatorId);
    } catch (error) {
      rejectStarted(error);
      throw error;
    } finally {
      inFlightProvisioning.delete(creatorId);
    }
  })();

  inFlightProvisioning.set(creatorId, { started, completed });

  if (options.awaitCompletion) {
    await completed;
    return {
      started: true,
      creator: await getCreatorById(creatorId),
      reason: "started",
    };
  }

  return {
    started: true,
    creator: await started,
    reason: "started",
  };
}
