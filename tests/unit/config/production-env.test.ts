import { describe, expect, it } from "vitest";
import {
  validateProductionEnv,
  type ProductionEnvironment,
} from "../../../src/config/validate-production-env.js";

function productionEnv(
  overrides: Partial<ProductionEnvironment> = {},
): ProductionEnvironment {
  return {
    NODE_ENV: "production",
    AI_PROVIDER: "anthropic",
    AI_API_KEY: "ai-key",
    ANTHROPIC_API_KEY: "",
    OPENAI_API_KEY: "",
    MESSAGING_LINK_SECRET: "messaging-secret",
    PRIVY_JWT_VERIFICATION_KEY: "privy-verification-key",
    ENABLE_YOUTUBE_OAUTH: false,
    GOOGLE_OAUTH_CLIENT_ID: "",
    GOOGLE_OAUTH_CLIENT_SECRET: "",
    YOUTUBE_OAUTH_REDIRECT_URI: "",
    ENABLE_TELEGRAM_BOT: true,
    TELEGRAM_MODE: "polling",
    TELEGRAM_BOT_TOKEN: "telegram-token",
    TELEGRAM_WEBHOOK_SECRET: "",
    ENABLE_WHATSAPP: false,
    WHATSAPP_PHONE_NUMBER_ID: "",
    WHATSAPP_ACCESS_TOKEN: "",
    WHATSAPP_VERIFY_TOKEN: "",
    WHATSAPP_WEBHOOK_SECRET: "",
    ENABLE_JOBS: true,
    ENABLE_DISTRIBUTED_RATE_LIMIT: false,
    REDIS_URL: "redis://redis:6379",
    PLATFORM_ENCRYPTION_KEY_VERSION: "v1",
    PLATFORM_ENCRYPTION_KEY_V1: "platform-encryption-key",
    ...overrides,
  };
}

describe("validateProductionEnv", () => {
  it("rejects a missing messaging link secret", () => {
    expect(() =>
      validateProductionEnv(productionEnv({ MESSAGING_LINK_SECRET: "" })),
    ).toThrow(/MESSAGING_LINK_SECRET/);
  });

  it("rejects the known development WhatsApp verify token when enabled", () => {
    expect(() =>
      validateProductionEnv(
        productionEnv({
          ENABLE_WHATSAPP: true,
          WHATSAPP_PHONE_NUMBER_ID: "phone-id",
          WHATSAPP_ACCESS_TOKEN: "access-token",
          WHATSAPP_VERIFY_TOKEN: "indyfren-verify",
          WHATSAPP_WEBHOOK_SECRET: "webhook-secret",
        }),
      ),
    ).toThrow(/WHATSAPP_VERIFY_TOKEN/);
  });

  it("requires a Telegram webhook secret in webhook mode", () => {
    expect(() =>
      validateProductionEnv(
        productionEnv({
          TELEGRAM_MODE: "webhook",
          TELEGRAM_WEBHOOK_SECRET: "",
        }),
      ),
    ).toThrow(/TELEGRAM_WEBHOOK_SECRET/);
  });

  it("rejects a missing platform encryption key", () => {
    expect(() =>
      validateProductionEnv(productionEnv({ PLATFORM_ENCRYPTION_KEY_V1: "" })),
    ).toThrow(/PLATFORM_ENCRYPTION_KEY_V1/);
  });

  it("reports all unsafe production fields in one error", () => {
    expect(() =>
      validateProductionEnv(
        productionEnv({
          MESSAGING_LINK_SECRET: "",
          PLATFORM_ENCRYPTION_KEY_VERSION: "",
          PLATFORM_ENCRYPTION_KEY_V1: "",
        }),
      ),
    ).toThrow(
      /MESSAGING_LINK_SECRET[\s\S]*PLATFORM_ENCRYPTION_KEY_VERSION[\s\S]*PLATFORM_ENCRYPTION_KEY_V1/,
    );
  });

  it("only requires Google credentials when YouTube OAuth is enabled", () => {
    expect(() => validateProductionEnv(productionEnv())).not.toThrow();
    expect(() =>
      validateProductionEnv(productionEnv({ ENABLE_YOUTUBE_OAUTH: true })),
    ).toThrow(/GOOGLE_OAUTH_CLIENT_ID[\s\S]*GOOGLE_OAUTH_CLIENT_SECRET/);
  });

  it("only requires Telegram credentials for the selected mode", () => {
    expect(() =>
      validateProductionEnv(
        productionEnv({
          TELEGRAM_MODE: "disabled",
          TELEGRAM_BOT_TOKEN: "",
        }),
      ),
    ).not.toThrow();
    expect(() =>
      validateProductionEnv(
        productionEnv({ TELEGRAM_MODE: "polling", TELEGRAM_BOT_TOKEN: "" }),
      ),
    ).toThrow(/TELEGRAM_BOT_TOKEN/);
  });

  it("requires Redis only when jobs or distributed rate limiting are enabled", () => {
    expect(() =>
      validateProductionEnv(
        productionEnv({
          ENABLE_JOBS: false,
          ENABLE_DISTRIBUTED_RATE_LIMIT: false,
          REDIS_URL: "",
        }),
      ),
    ).not.toThrow();
    expect(() =>
      validateProductionEnv(productionEnv({ REDIS_URL: "" })),
    ).toThrow(/REDIS_URL/);
  });

  it("does not enforce production-only requirements outside production", () => {
    expect(() =>
      validateProductionEnv(
        productionEnv({
          NODE_ENV: "test",
          MESSAGING_LINK_SECRET: "",
          PLATFORM_ENCRYPTION_KEY_VERSION: "",
          PLATFORM_ENCRYPTION_KEY_V1: "",
          REDIS_URL: "",
        }),
      ),
    ).not.toThrow();
  });
});
