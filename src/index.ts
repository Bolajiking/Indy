import { serve } from "@hono/node-server";
import { pathToFileURL } from "node:url";
import pino from "#logger";
import { createApiServer } from "./api/server.js";
import { initializeRateLimitStore } from "./api/rate-limit-store.js";
import { installCreatorRateLimits } from "./api/middleware/rate-limit.js";
import { agent } from "./api/routes/agent.js";
import { auth } from "./api/routes/auth.js";
import { deals } from "./api/routes/deals.js";
import { platforms } from "./api/routes/platforms.js";
import { reports } from "./api/routes/reports.js";
import { wallet } from "./api/routes/wallet.js";
import { messaging } from "./api/routes/messaging.js";
import { connections } from "./api/routes/connections.js";
import { account } from "./api/routes/account.js";
import { createWebhookRoutes } from "./api/routes/webhooks.js";
import { createHealthRoutes } from "./api/routes/health.js";
import {
  createTelegramBot,
  isTelegramConfigured,
  registerTelegramBot,
} from "./bot/telegram.js";
import { env } from "./config/env.js";
import { validateProductionEnv } from "./config/validate-production-env.js";
import {
  createSignalShutdownHandler,
  RuntimeLifecycle,
} from "./runtime/shutdown.js";

import "./agent/tools/enrichment.js";
import "./agent/tools/web-search.js";
import "./agent/tools/email-sender.js";
import "./agent/tools/platform-analytics.js";
import "./agent/tools/media-kit-generator.js";
import "./agent/tools/browser.js";
import { loadMCPServers } from "./agent/tools/mcp-adapter.js";

const log = pino({ name: "indyfren" });

type TelegramMode = "disabled" | "polling" | "webhook";
type StartableTelegramBot = {
  start: () => Promise<void> | void;
  stop?: () => Promise<void> | void;
};

export function startTelegramMode<T extends StartableTelegramBot>(options: {
  enabled: boolean;
  configured: boolean;
  mode: TelegramMode;
  createBot: () => T;
  registerBot: (bot: T) => void;
  registerWebhook: (bot: T) => void;
}): T | null {
  if (!options.enabled || options.mode === "disabled") return null;
  if (!options.configured) return null;

  const bot = options.createBot();
  options.registerBot(bot);

  if (options.mode === "polling") {
    Promise.resolve(bot.start()).catch((error) => {
      log.error({ error }, "Telegram bot failed to start in polling mode");
    });
  } else {
    options.registerWebhook(bot);
  }

  return bot;
}

export async function main() {
  validateProductionEnv(env);
  const lifecycle = new RuntimeLifecycle();

  // Load MCP tool servers (non-blocking — failures logged, not fatal)
  loadMCPServers().catch((err) =>
    log.error({ err }, "MCP server initialization failed"),
  );

  const rateLimitStore = await initializeRateLimitStore({
    nodeEnv: env.NODE_ENV,
    distributed: env.ENABLE_DISTRIBUTED_RATE_LIMIT,
    redisUrl: env.REDIS_URL,
  });
  const app = createApiServer({
    rateLimitStore,
    trustedProxyHops: env.TRUSTED_PROXY_HOPS,
  });

  let telegramWebhookBot: ReturnType<typeof createTelegramBot> | null = null;
  const telegramBot = startTelegramMode({
    enabled: env.ENABLE_TELEGRAM_BOT,
    configured: isTelegramConfigured(),
    mode: env.TELEGRAM_MODE,
    createBot: createTelegramBot,
    registerBot: registerTelegramBot,
    registerWebhook: (bot) => {
      telegramWebhookBot = bot;
    },
  });

  installCreatorRateLimits(app, { store: rateLimitStore });
  app.route(
    "/health",
    createHealthRoutes({
      checkRateLimit: env.ENABLE_DISTRIBUTED_RATE_LIMIT
        ? async () => {
            if (!rateLimitStore.ready) throw new Error("Readiness unavailable");
            await rateLimitStore.ready();
          }
        : undefined,
      checkQueue: env.ENABLE_JOBS
        ? async () => {
            const { checkQueueReadiness } = await import("./jobs/queue.js");
            await checkQueueReadiness();
          }
        : undefined,
      isShuttingDown: () => lifecycle.isShuttingDown,
    }),
  );
  app.route(
    "/webhooks",
    createWebhookRoutes({
      telegramMode:
        env.ENABLE_TELEGRAM_BOT && telegramBot ? env.TELEGRAM_MODE : "disabled",
      telegramBot: telegramWebhookBot,
      telegramWebhookSecret: env.TELEGRAM_WEBHOOK_SECRET,
      whatsappEnabled: env.ENABLE_WHATSAPP,
      whatsappVerifyToken: env.WHATSAPP_VERIFY_TOKEN,
    }),
  );
  app.route("/api/agent", agent);
  app.route("/api/auth", auth);
  app.route("/api/deals", deals);
  app.route("/api/platforms", platforms);
  app.route("/api/reports", reports);
  app.route("/api/wallet", wallet);
  app.route("/api/messaging-links", messaging);
  app.route("/api/connections", connections);
  app.route("/api/account", account);

  if (!env.ENABLE_TELEGRAM_BOT || env.TELEGRAM_MODE === "disabled") {
    log.warn("Telegram bot startup is disabled");
  } else if (!telegramBot) {
    log.warn(
      "Telegram bot not started because TELEGRAM_BOT_TOKEN is not configured",
    );
  } else {
    log.info({ mode: env.TELEGRAM_MODE }, "Telegram bot configured");
  }

  if (env.ENABLE_JOBS) {
    const { scheduleRecurringJobs, startWorkers } =
      await import("./jobs/queue.js");
    const worker = startWorkers({ telegramBot: telegramWebhookBot });
    // Do not bind the webhook ingress until the same process has confirmed it
    // can consume the durable receipts it will acknowledge.
    await worker.waitUntilReady();
    await scheduleRecurringJobs();
  } else {
    log.warn("Job system startup is disabled via ENABLE_JOBS=false");
  }

  const server = serve(
    {
      fetch: app.fetch,
      port: env.PORT,
    },
    (info) => {
      log.info({ port: info.port }, "API server started");
    },
  );

  lifecycle.register({
    name: "http-server",
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  });
  if (telegramBot?.stop) {
    lifecycle.register({
      name: "telegram",
      close: () => telegramBot.stop?.(),
    });
  }
  if (env.ENABLE_JOBS) {
    lifecycle.register({
      name: "job-queue",
      close: async () => {
        const { closeQueueResources } = await import("./jobs/queue.js");
        await closeQueueResources();
      },
    });
  }
  if (rateLimitStore.close) {
    lifecycle.register({
      name: "rate-limit-store",
      close: () => rateLimitStore.close?.(),
    });
  }

  const shutdown = createSignalShutdownHandler({
    lifecycle,
    timeoutMs: 30_000,
    onTimeout: (pending) =>
      log.error({ pending }, "Graceful shutdown deadline exceeded"),
    onError: (error) => log.error({ error }, "Graceful shutdown failed"),
  });
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);

  log.info("Indyfren is running");
  return { lifecycle, server };
}

const isEntrypoint =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  main().catch((error) => {
    log.error({ error }, "Fatal startup error");
    process.exit(1);
  });
}
