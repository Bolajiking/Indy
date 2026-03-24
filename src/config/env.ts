import { z } from "zod";
import { config } from "dotenv";

config({ path: ".env.local", override: false });
config({ path: ".env", override: false });

const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_KEY: z.string().min(1),
  PRIVY_APP_ID: z.string().min(1),
  PRIVY_APP_SECRET: z.string().min(1),
  PRIVY_JWT_VERIFICATION_KEY: z.string().default(""),
  MESSAGING_LINK_SECRET: z.string().default(""),
  GOOGLE_OAUTH_CLIENT_ID: z.string().default(""),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().default(""),
  YOUTUBE_OAUTH_REDIRECT_URI: z.union([z.string().url(), z.literal("")]).default(""),
  DASHBOARD_APP_URL: z.union([z.string().url(), z.literal("")]).default(""),
  TELEGRAM_BOT_TOKEN: z.string().default(""),
  TELEGRAM_BOT_USERNAME: z.string().default(""),
  WHATSAPP_PHONE_NUMBER_ID: z.string().default(""),
  WHATSAPP_BUSINESS_PHONE: z.string().default(""),
  WHATSAPP_ACCESS_TOKEN: z.string().default(""),
  WHATSAPP_VERIFY_TOKEN: z.string().default("indyfren-verify"),
  WHATSAPP_WEBHOOK_SECRET: z.string().default(""),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  BROWSERBASE_API_KEY: z.string().default(""),
  BROWSERBASE_PROJECT_ID: z.string().default(""),
  ENABLE_TELEGRAM_BOT: z
    .string()
    .default("true")
    .transform((value) => value.toLowerCase() !== "false"),
  ENABLE_JOBS: z
    .string()
    .default("true")
    .transform((value) => value.toLowerCase() !== "false"),
  PORT: z.string().default("3000").transform(Number),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export const env = envSchema.parse(process.env);
