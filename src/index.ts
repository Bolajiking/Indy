import { serve } from "@hono/node-server";
import pino from "pino";
import { createApiServer } from "./api/server.js";
import { agent } from "./api/routes/agent.js";
import { auth } from "./api/routes/auth.js";
import { deals } from "./api/routes/deals.js";
import { platforms } from "./api/routes/platforms.js";
import { reports } from "./api/routes/reports.js";
import { wallet } from "./api/routes/wallet.js";
import { messaging } from "./api/routes/messaging.js";
import { connections } from "./api/routes/connections.js";
import { webhooks, setTelegramBotForWebhook } from "./api/routes/webhooks.js";
import { health } from "./api/routes/health.js";
import {
  createTelegramBot,
  isTelegramConfigured,
  registerTelegramBot,
} from "./bot/telegram.js";
import { env } from "./config/env.js";
import { validateProductionEnv } from "./config/validate-production-env.js";

import "./agent/tools/enrichment.js";
import "./agent/tools/web-search.js";
import "./agent/tools/email-sender.js";
import "./agent/tools/platform-analytics.js";
import "./agent/tools/media-kit-generator.js";
import "./agent/tools/browser.js";
import { loadMCPServers } from "./agent/tools/mcp-adapter.js";

const log = pino({ name: "indyfren" });

async function main() {
  validateProductionEnv(env);

  // Load MCP tool servers (non-blocking — failures logged, not fatal)
  loadMCPServers().catch((err) =>
    log.error({ err }, "MCP server initialization failed"),
  );

  const app = createApiServer();
  app.route("/health", health);
  app.route("/webhooks", webhooks);
  app.route("/api/agent", agent);
  app.route("/api/auth", auth);
  app.route("/api/deals", deals);
  app.route("/api/platforms", platforms);
  app.route("/api/reports", reports);
  app.route("/api/wallet", wallet);
  app.route("/api/messaging-links", messaging);
  app.route("/api/connections", connections);

  serve(
    {
      fetch: app.fetch,
      port: env.PORT,
    },
    (info) => {
      log.info({ port: info.port }, "API server started");
    },
  );

  if (
    env.ENABLE_TELEGRAM_BOT &&
    env.TELEGRAM_MODE !== "disabled" &&
    isTelegramConfigured()
  ) {
    const telegramBot = createTelegramBot();
    registerTelegramBot(telegramBot);
    setTelegramBotForWebhook(telegramBot);

    if (env.TELEGRAM_MODE === "polling") {
      log.info("Telegram bot instance created, starting long-polling...");
      telegramBot.start().catch((error) => {
        log.error({ error }, "Telegram bot failed to start");
      });
    } else {
      log.info("Telegram bot registered in webhook mode");
    }
  } else if (!env.ENABLE_TELEGRAM_BOT || env.TELEGRAM_MODE === "disabled") {
    log.warn("Telegram bot startup is disabled");
  } else {
    log.warn(
      "Telegram bot not started because TELEGRAM_BOT_TOKEN is not configured",
    );
  }

  if (env.ENABLE_JOBS) {
    try {
      const { scheduleRecurringJobs, startWorkers } =
        await import("./jobs/queue.js");
      startWorkers();
      await scheduleRecurringJobs();
    } catch (error) {
      log.warn({ error }, "Job system not started");
    }
  } else {
    log.warn("Job system startup is disabled via ENABLE_JOBS=false");
  }

  log.info("Indyfren is running");
}

main().catch((error) => {
  log.error({ err: error }, "Fatal startup error");
  process.exit(1);
});
