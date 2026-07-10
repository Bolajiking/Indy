import { z } from "zod";

function strictBoolean(defaultValue: boolean) {
  const defaultLiteral = defaultValue ? "true" : "false";
  return z
    .preprocess(
      (value) =>
        typeof value === "string" ? value.trim().toLowerCase() : value,
      z.enum(["true", "false"]).default(defaultLiteral),
    )
    .transform((value) => value === "true");
}

const rawEnvObjectSchema = z.object({
  // ── AI provider selection ──────────────────────────────────────────────
  // "anthropic" (default) talks to the Anthropic Messages API. "openai" talks
  // to any OpenAI-compatible Chat Completions endpoint (OpenAI, Azure OpenAI,
  // OpenRouter, LiteLLM, Ollama, vLLM, LM Studio, OpenClaw gateways, …) — point
  // AI_BASE_URL at it. AI_MODEL / AI_FAST_MODEL override the model per tier.
  AI_PROVIDER: z.enum(["anthropic", "openai"]).default("anthropic"),
  AI_BASE_URL: z.string().default(""),
  AI_API_KEY: z.string().default(""),
  AI_MODEL: z.string().default(""),
  AI_FAST_MODEL: z.string().default(""),
  // Anthropic key is only required when AI_PROVIDER=anthropic (validated in the
  // provider). OPENAI_API_KEY is a convenience fallback for the openai provider.
  ANTHROPIC_API_KEY: z.string().default(""),
  OPENAI_API_KEY: z.string().default(""),
  // ── Composio (connector backbone) ──────────────────────────────────────
  // COMPOSIO_API_KEY enables Composio-backed account connections. Auth configs
  // are created per toolkit in the Composio dashboard; map toolkit slug →
  // authConfigId as JSON, e.g. {"gmail":"ac_123","slack":"ac_456"}.
  COMPOSIO_API_KEY: z.string().default(""),
  COMPOSIO_AUTH_CONFIGS: z.string().default("{}"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_KEY: z.string().min(1),
  PRIVY_APP_ID: z.string().min(1),
  PRIVY_APP_SECRET: z.string().min(1),
  PRIVY_JWT_VERIFICATION_KEY: z.string().default(""),
  MESSAGING_LINK_SECRET: z.string().default(""),
  GOOGLE_OAUTH_CLIENT_ID: z.string().default(""),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().default(""),
  ENABLE_YOUTUBE_OAUTH: strictBoolean(false),
  YOUTUBE_OAUTH_REDIRECT_URI: z
    .union([z.string().url(), z.literal("")])
    .default(""),
  DASHBOARD_APP_URL: z.union([z.string().url(), z.literal("")]).default(""),
  TELEGRAM_BOT_TOKEN: z.string().default(""),
  TELEGRAM_BOT_USERNAME: z.string().default(""),
  TELEGRAM_MODE: z.enum(["disabled", "polling", "webhook"]).default("polling"),
  TELEGRAM_WEBHOOK_SECRET: z.string().default(""),
  WHATSAPP_PHONE_NUMBER_ID: z.string().default(""),
  WHATSAPP_BUSINESS_PHONE: z.string().default(""),
  WHATSAPP_ACCESS_TOKEN: z.string().default(""),
  WHATSAPP_VERIFY_TOKEN: z.string().default(""),
  WHATSAPP_WEBHOOK_SECRET: z.string().default(""),
  ENABLE_WHATSAPP: strictBoolean(false),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  APPROVAL_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(60)
    .max(86_400)
    .default(900),
  ENABLE_DISTRIBUTED_RATE_LIMIT: strictBoolean(false),
  TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).max(2).default(0),
  PLATFORM_ENCRYPTION_KEY_VERSION: z
    .string()
    .regex(/^$|^[1-9]\d*$/)
    .default(""),
  PLATFORM_ENCRYPTION_KEY_CURRENT: z.string().default(""),
  PLATFORM_ENCRYPTION_KEY_PREVIOUS_VERSION: z
    .string()
    .regex(/^$|^[1-9]\d*$/)
    .default(""),
  PLATFORM_ENCRYPTION_KEY_PREVIOUS: z.string().default(""),
  ERROR_REPORTING_DSN: z.string().default(""),
  PUBLIC_SUPPORT_EMAIL: z
    .union([z.string().email(), z.literal("")])
    .default(""),
  BROWSERBASE_API_KEY: z.string().default(""),
  BROWSERBASE_PROJECT_ID: z.string().default(""),
  ENABLE_TELEGRAM_BOT: strictBoolean(true),
  ENABLE_JOBS: strictBoolean(true),
  PORT: z.string().default("3000").transform(Number),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

const rawEnvSchema = rawEnvObjectSchema.superRefine((parsed, context) => {
  for (const field of [
    "PLATFORM_ENCRYPTION_KEY_VERSION",
    "PLATFORM_ENCRYPTION_KEY_PREVIOUS_VERSION",
  ] as const) {
    const raw = parsed[field];
    if (raw && !Number.isSafeInteger(Number(raw))) {
      context.addIssue({
        code: "custom",
        path: [field],
        message:
          "Platform encryption key version must be a positive safe integer",
      });
    }
  }
  const validKey = (value: string) => {
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
    const decoded = Buffer.from(value, "base64");
    return decoded.length === 32 && decoded.toString("base64") === value;
  };
  if (
    parsed.PLATFORM_ENCRYPTION_KEY_CURRENT &&
    !validKey(parsed.PLATFORM_ENCRYPTION_KEY_CURRENT)
  ) {
    context.addIssue({
      code: "custom",
      path: ["PLATFORM_ENCRYPTION_KEY_CURRENT"],
      message:
        "Platform encryption key must be canonical base64 encoding of exactly 32 bytes",
    });
  }
  if (
    parsed.PLATFORM_ENCRYPTION_KEY_PREVIOUS &&
    !validKey(parsed.PLATFORM_ENCRYPTION_KEY_PREVIOUS)
  ) {
    context.addIssue({
      code: "custom",
      path: ["PLATFORM_ENCRYPTION_KEY_PREVIOUS"],
      message:
        "Previous platform encryption key must be canonical base64 encoding of exactly 32 bytes",
    });
  }
  if (
    Boolean(parsed.PLATFORM_ENCRYPTION_KEY_PREVIOUS_VERSION) !==
    Boolean(parsed.PLATFORM_ENCRYPTION_KEY_PREVIOUS)
  ) {
    context.addIssue({
      code: "custom",
      path: ["PLATFORM_ENCRYPTION_KEY_PREVIOUS_VERSION"],
      message:
        "Previous platform key version and key must be configured together",
    });
  }
  if (
    parsed.PLATFORM_ENCRYPTION_KEY_PREVIOUS_VERSION ===
      parsed.PLATFORM_ENCRYPTION_KEY_VERSION &&
    parsed.PLATFORM_ENCRYPTION_KEY_PREVIOUS_VERSION
  ) {
    context.addIssue({
      code: "custom",
      path: ["PLATFORM_ENCRYPTION_KEY_PREVIOUS_VERSION"],
      message: "Previous platform key version must differ from current",
    });
  }
  if (
    parsed.ENABLE_TELEGRAM_BOT &&
    parsed.TELEGRAM_MODE === "webhook" &&
    !/^[A-Za-z0-9_-]{1,256}$/.test(parsed.TELEGRAM_WEBHOOK_SECRET)
  ) {
    context.addIssue({
      code: "custom",
      path: ["TELEGRAM_WEBHOOK_SECRET"],
      message:
        "Telegram webhook secret must contain 1-256 letters, numbers, underscores, or hyphens",
    });
  }

  // Webhook receipts are only acknowledged after they have been claimed for
  // asynchronous delivery. Running an ingress without workers would therefore
  // acknowledge provider updates that can never be processed.
  const webhookDeliveryEnabled =
    (parsed.ENABLE_TELEGRAM_BOT && parsed.TELEGRAM_MODE === "webhook") ||
    parsed.ENABLE_WHATSAPP;
  if (webhookDeliveryEnabled && !parsed.ENABLE_JOBS) {
    context.addIssue({
      code: "custom",
      path: ["ENABLE_JOBS"],
      message:
        "ENABLE_JOBS must be true when Telegram webhook mode or WhatsApp webhooks are enabled",
    });
  }
});

export const envSchema = rawEnvSchema.transform((parsed) => ({
  ...parsed,
  WHATSAPP_VERIFY_TOKEN:
    parsed.WHATSAPP_VERIFY_TOKEN ||
    (parsed.NODE_ENV === "production" ? "" : "indyfren-verify"),
}));

export type Env = z.infer<typeof envSchema>;
