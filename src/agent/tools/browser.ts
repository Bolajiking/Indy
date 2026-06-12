import {
  readStringParam,
  registerTool,
  type AgentTool,
} from "./registry.js";
import pino from "pino";
import { env } from "../../config/env.js";
import { isRecord } from "../../db/json.js";

const log = pino({ name: "tool:browser" });

function isBrowserSessionResponse(value: unknown): value is { id: string } {
  return isRecord(value) && typeof value.id === "string";
}

const browserTool: AgentTool = {
  name: "browse_web",
  description:
    "Browse a webpage using a headless browser via BrowserBase. Can extract text content, take screenshots, and interact with pages. Useful for scraping brand deal platforms, monitoring competitor pages, and researching brands.",
  autonomyLevel: "autonomous",
  costCategory: "platform-api",
  maxCostPerUseCents: 50,
  parameters: {
    url: {
      type: "string",
      description: "The URL to browse",
      required: true,
    },
    action: {
      type: "string",
      description:
        "Action to perform: 'extract_text' (get page text), 'extract_links' (get all links), 'screenshot' (capture page). Defaults to 'extract_text'.",
      required: false,
    },
    selector: {
      type: "string",
      description:
        "Optional CSS selector to scope extraction to a specific element",
      required: false,
    },
  },
  async execute(params) {
    if (!env.BROWSERBASE_API_KEY || !env.BROWSERBASE_PROJECT_ID) {
      return {
        success: false,
        data: null,
        error:
          "BrowserBase is not configured. Set BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID.",
      };
    }

    const url = readStringParam(params, "url");
    if (!url) {
      return {
        success: false,
        data: null,
        error: "url is required",
      };
    }

    const action = readStringParam(params, "action") ?? "extract_text";
    const selector = readStringParam(params, "selector");

    try {
      const sessionRes = await fetch(
        "https://www.browserbase.com/v1/sessions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-bb-api-key": env.BROWSERBASE_API_KEY,
          },
          body: JSON.stringify({
            projectId: env.BROWSERBASE_PROJECT_ID,
          }),
        },
      );

      if (!sessionRes.ok) {
        const errText = await sessionRes.text();
        return {
          success: false,
          data: null,
          error: `Failed to create browser session: ${sessionRes.status} - ${errText}`,
        };
      }

      const session: unknown = await sessionRes.json();
      if (!isBrowserSessionResponse(session)) {
        return {
          success: false,
          data: null,
          error:
            "Failed to create browser session: response missing session id",
        };
      }
      log.info({ sessionId: session.id, url }, "Browser session created");

      const contentRes = await fetch(
        `https://www.browserbase.com/v1/sessions/${session.id}/browser/content`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-bb-api-key": env.BROWSERBASE_API_KEY,
          },
          body: JSON.stringify({
            url,
            action,
            selector: selector ?? undefined,
            waitForSelector: selector ?? undefined,
            timeout: 30000,
          }),
        },
      );

      if (!contentRes.ok) {
        const errText = await contentRes.text();
        return {
          success: false,
          data: null,
          error: `Browser extraction failed: ${contentRes.status} - ${errText}`,
        };
      }

      const content: unknown = await contentRes.json();

      return {
        success: true,
        data: {
          url,
          action,
          result: content,
        },
        costCents: 10,
      };
    } catch (error) {
      log.error({ url, error }, "Browser tool failed");
      return {
        success: false,
        data: null,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error during browsing",
      };
    }
  },
};

registerTool(browserTool);
