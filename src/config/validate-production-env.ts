import type { Env } from "./env-schema.js";

export type ProductionEnvironment = Pick<
  Env,
  | "NODE_ENV"
  | "AI_PROVIDER"
  | "AI_API_KEY"
  | "ANTHROPIC_API_KEY"
  | "OPENAI_API_KEY"
  | "MESSAGING_LINK_SECRET"
  | "PRIVY_JWT_VERIFICATION_KEY"
  | "ENABLE_YOUTUBE_OAUTH"
  | "GOOGLE_OAUTH_CLIENT_ID"
  | "GOOGLE_OAUTH_CLIENT_SECRET"
  | "YOUTUBE_OAUTH_REDIRECT_URI"
  | "ENABLE_TELEGRAM_BOT"
  | "TELEGRAM_MODE"
  | "TELEGRAM_BOT_TOKEN"
  | "TELEGRAM_WEBHOOK_SECRET"
  | "ENABLE_WHATSAPP"
  | "WHATSAPP_PHONE_NUMBER_ID"
  | "WHATSAPP_ACCESS_TOKEN"
  | "WHATSAPP_VERIFY_TOKEN"
  | "WHATSAPP_WEBHOOK_SECRET"
  | "ENABLE_JOBS"
  | "ENABLE_DISTRIBUTED_RATE_LIMIT"
  | "REDIS_URL"
  | "PLATFORM_ENCRYPTION_KEY_VERSION"
  | "PLATFORM_ENCRYPTION_KEY_V1"
>;

export type ProductionEnvIssue = {
  field: keyof ProductionEnvironment;
  message: string;
};

function isMissing(value: string): boolean {
  return value.trim().length === 0;
}

export function getProductionEnvIssues(
  config: ProductionEnvironment,
): ProductionEnvIssue[] {
  const issues: ProductionEnvIssue[] = [];
  const requireValue = (
    field: keyof ProductionEnvironment,
    value: string,
    reason: string,
  ) => {
    if (isMissing(value)) issues.push({ field, message: reason });
  };

  const aiKey =
    config.AI_PROVIDER === "openai"
      ? config.AI_API_KEY || config.OPENAI_API_KEY
      : config.AI_API_KEY || config.ANTHROPIC_API_KEY;
  requireValue(
    "AI_API_KEY",
    aiKey,
    `credentials are required for AI_PROVIDER=${config.AI_PROVIDER}`,
  );
  requireValue(
    "PRIVY_JWT_VERIFICATION_KEY",
    config.PRIVY_JWT_VERIFICATION_KEY,
    "required to verify production access tokens",
  );
  requireValue(
    "MESSAGING_LINK_SECRET",
    config.MESSAGING_LINK_SECRET,
    "required to sign messaging link tokens",
  );
  if (config.PLATFORM_ENCRYPTION_KEY_VERSION !== "v1") {
    issues.push({
      field: "PLATFORM_ENCRYPTION_KEY_VERSION",
      message: "must be v1 in production",
    });
  }
  requireValue(
    "PLATFORM_ENCRYPTION_KEY_V1",
    config.PLATFORM_ENCRYPTION_KEY_V1,
    "required to encrypt stored platform credentials",
  );

  if (config.ENABLE_YOUTUBE_OAUTH) {
    requireValue(
      "GOOGLE_OAUTH_CLIENT_ID",
      config.GOOGLE_OAUTH_CLIENT_ID,
      "required when YouTube OAuth is enabled",
    );
    requireValue(
      "GOOGLE_OAUTH_CLIENT_SECRET",
      config.GOOGLE_OAUTH_CLIENT_SECRET,
      "required when YouTube OAuth is enabled",
    );
    requireValue(
      "YOUTUBE_OAUTH_REDIRECT_URI",
      config.YOUTUBE_OAUTH_REDIRECT_URI,
      "required when YouTube OAuth is enabled",
    );
  }

  const telegramEnabled =
    config.ENABLE_TELEGRAM_BOT && config.TELEGRAM_MODE !== "disabled";
  if (telegramEnabled) {
    requireValue(
      "TELEGRAM_BOT_TOKEN",
      config.TELEGRAM_BOT_TOKEN,
      `required for Telegram ${config.TELEGRAM_MODE} mode`,
    );
  }
  if (telegramEnabled && config.TELEGRAM_MODE === "webhook") {
    requireValue(
      "TELEGRAM_WEBHOOK_SECRET",
      config.TELEGRAM_WEBHOOK_SECRET,
      "required for Telegram webhook mode",
    );
  }

  if (config.ENABLE_WHATSAPP) {
    requireValue(
      "WHATSAPP_PHONE_NUMBER_ID",
      config.WHATSAPP_PHONE_NUMBER_ID,
      "required when WhatsApp is enabled",
    );
    requireValue(
      "WHATSAPP_ACCESS_TOKEN",
      config.WHATSAPP_ACCESS_TOKEN,
      "required when WhatsApp is enabled",
    );
    requireValue(
      "WHATSAPP_VERIFY_TOKEN",
      config.WHATSAPP_VERIFY_TOKEN,
      "required when WhatsApp is enabled",
    );
    requireValue(
      "WHATSAPP_WEBHOOK_SECRET",
      config.WHATSAPP_WEBHOOK_SECRET,
      "required when WhatsApp is enabled",
    );
    if (config.WHATSAPP_VERIFY_TOKEN.trim() === "indyfren-verify") {
      issues.push({
        field: "WHATSAPP_VERIFY_TOKEN",
        message: "must not use the known development value indyfren-verify",
      });
    }
  }

  if (!config.ENABLE_DISTRIBUTED_RATE_LIMIT) {
    issues.push({
      field: "ENABLE_DISTRIBUTED_RATE_LIMIT",
      message: "must be enabled in production",
    });
  }

  if (config.ENABLE_JOBS || config.ENABLE_DISTRIBUTED_RATE_LIMIT) {
    requireValue(
      "REDIS_URL",
      config.REDIS_URL,
      "required when jobs or distributed rate limiting are enabled",
    );
  }

  return issues;
}

export function validateProductionEnv(config: ProductionEnvironment): void {
  if (config.NODE_ENV !== "production") return;

  const issues = getProductionEnvIssues(config);
  if (issues.length === 0) return;

  const detail = issues
    .map(({ field, message }) => `- ${field}: ${message}`)
    .join("\n");
  throw new Error(`Unsafe production configuration:\n${detail}`);
}
