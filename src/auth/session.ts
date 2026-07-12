import pino from "#logger";
import {
  findCreatorByTelegram,
  getCreatorByPrivyUserId,
  updateCreator,
} from "../db/queries/creators.js";
import {
  CREATOR_SERVICE_UNAVAILABLE_MESSAGE,
  isDatabaseServiceUnavailableError,
} from "../db/errors.js";
import { privy } from "../wallet/privy.js";

const log = pino({ name: "auth:session" });

export { CREATOR_SERVICE_UNAVAILABLE_MESSAGE };

export class AuthTokenVerificationError extends Error {
  constructor(message = "Invalid bearer token", options?: ErrorOptions) {
    super(message, options);
    this.name = "AuthTokenVerificationError";
  }
}

export class CreatorResolutionError extends Error {
  constructor(
    message = CREATOR_SERVICE_UNAVAILABLE_MESSAGE,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "CreatorResolutionError";
  }
}

export interface AuthenticatedSession {
  accessToken: string;
  privyUserId: string;
  creatorId: string | null;
  creatorResolutionError?: CreatorResolutionError;
}

function getLinkedTelegramUserId(
  user: {
    linked_accounts?: Array<{ type?: string; telegram_user_id?: string }>;
  } | null,
): string | null {
  const linkedTelegramAccount = user?.linked_accounts?.find(
    (account) =>
      account?.type === "telegram" &&
      typeof account.telegram_user_id === "string",
  );

  return linkedTelegramAccount?.telegram_user_id ?? null;
}

async function resolveCreatorForPrivyUser(privyUserId: string) {
  const existingCreator = await getCreatorByPrivyUserId(privyUserId).catch(
    (error) => {
      if (isDatabaseServiceUnavailableError(error)) {
        throw new CreatorResolutionError(undefined, { cause: error });
      }

      log.warn(
        { error, privyUserId },
        "Failed to resolve creator for Privy user",
      );
      throw new CreatorResolutionError(undefined, { cause: error });
    },
  );
  if (existingCreator) {
    return existingCreator;
  }

  const privyUser = await privy
    .users()
    ._get(privyUserId)
    .catch((error) => {
      log.warn({ error, privyUserId }, "Failed to read Privy linked accounts");
      return null;
    });
  const telegramUserId = getLinkedTelegramUserId(privyUser);
  if (!telegramUserId) {
    return null;
  }

  const telegramCreator = await findCreatorByTelegram(telegramUserId).catch(
    (error) => {
      if (isDatabaseServiceUnavailableError(error)) {
        throw new CreatorResolutionError(undefined, { cause: error });
      }

      log.warn(
        { error, privyUserId, telegramUserId },
        "Failed to resolve Telegram creator during Privy claim",
      );
      throw new CreatorResolutionError(undefined, { cause: error });
    },
  );

  if (!telegramCreator) {
    return null;
  }

  if (
    telegramCreator.privy_user_id &&
    telegramCreator.privy_user_id !== privyUserId
  ) {
    log.warn(
      {
        creatorId: telegramCreator.id,
        creatorPrivyUserId: telegramCreator.privy_user_id,
        privyUserId,
        telegramUserId,
      },
      "Telegram creator is already claimed by another Privy identity",
    );
    return null;
  }

  if (telegramCreator.privy_user_id === privyUserId) {
    return telegramCreator;
  }

  const claimedCreator = await updateCreator(telegramCreator.id, {
    privy_user_id: privyUserId,
  }).catch((error) => {
    if (isDatabaseServiceUnavailableError(error)) {
      throw new CreatorResolutionError(undefined, { cause: error });
    }

    log.warn(
      { error, creatorId: telegramCreator.id, privyUserId, telegramUserId },
      "Failed to claim Telegram creator for Privy user",
    );
    throw new CreatorResolutionError(undefined, { cause: error });
  });

  return claimedCreator;
}

export async function authenticateAccessToken(
  accessToken: string,
): Promise<AuthenticatedSession> {
  const verified = await privy
    .utils()
    .auth()
    .verifyAccessToken(accessToken)
    .catch((error) => {
      throw new AuthTokenVerificationError(undefined, { cause: error });
    });

  try {
    const creator = await resolveCreatorForPrivyUser(verified.user_id);

    return {
      accessToken,
      privyUserId: verified.user_id,
      creatorId: creator?.id ?? null,
    };
  } catch (error) {
    if (error instanceof CreatorResolutionError) {
      log.warn(
        {
          error: error.cause ?? error,
          privyUserId: verified.user_id,
        },
        "Creator resolution failed during bearer auth",
      );

      return {
        accessToken,
        privyUserId: verified.user_id,
        creatorId: null,
        creatorResolutionError: error,
      };
    }

    throw error;
  }
}
