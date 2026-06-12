/**
 * Connection manager tool.
 *
 * Lets the agent surface account/channel connection prompts directly in chat
 * when a creator asks to connect something (e.g. "connect my YouTube and
 * Telegram"). The actual OAuth / linking happens in the user's browser, so this
 * tool does not perform the connection itself — it validates the requested
 * targets and signals the dashboard to render inline "Continue to …" cards.
 */

import { registerTool, type ToolResult } from "./registry.js";
import {
  disconnectComposioToolkit,
  getComposioToolkits,
  isComposioToolkit,
} from "../../integrations/composio.js";

// First-party services with a native connect path in the product.
const NATIVE = new Set([
  "youtube",
  "instagram",
  "tiktok",
  "x",
  "telegram",
  "whatsapp",
]);
const ALIASES: Record<string, string> = { twitter: "x" };

// Computed once at startup so the tool schema mirrors enabled Composio toolkits.
function supportedServices(): string[] {
  return [...new Set([...NATIVE, ...getComposioToolkits()])];
}
const SUPPORTED_LIST = supportedServices().join(", ");

function normalizeService(raw: string): string | null {
  const key = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  if (!key) return null;
  const canonical = ALIASES[key] ?? key;
  if (NATIVE.has(canonical) || isComposioToolkit(canonical)) return canonical;
  return null;
}

export function parseConnectionTargets(servicesParam: unknown): {
  supported: string[];
  unsupported: string[];
} {
  const raw =
    typeof servicesParam === "string"
      ? servicesParam.split(/[,\n]/)
      : Array.isArray(servicesParam)
        ? servicesParam.map(String)
        : [];

  const supported = new Set<string>();
  const unsupported = new Set<string>();
  for (const entry of raw) {
    const canonical = normalizeService(entry);
    if (canonical) supported.add(canonical);
    else if (entry.trim()) unsupported.add(entry.trim().toLowerCase());
  }

  return { supported: [...supported], unsupported: [...unsupported] };
}

registerTool({
  name: "request_connections",
  description: `Surface inline connection prompts in the dashboard chat so the creator can connect an account or messaging channel without leaving the conversation. Use this whenever the creator asks to connect, link, or authorize something. Supported services: ${SUPPORTED_LIST}. Pass \`services\` as a comma-separated list.`,
  autonomyLevel: "autonomous",
  costCategory: "free",
  maxCostPerUseCents: 0,
  parameters: {
    services: {
      type: "string",
      description: `Comma-separated services to connect, e.g. "gmail, youtube". Supported: ${SUPPORTED_LIST}.`,
      required: true,
    },
  },
  execute: async (params): Promise<ToolResult> => {
    const { supported, unsupported } = parseConnectionTargets(params.services);

    if (supported.length === 0) {
      return {
        success: false,
        data: {
          surfaced: [],
          unsupported,
          message:
            unsupported.length > 0
              ? `None of those can be connected yet (${unsupported.join(", ")}). Supported: YouTube, Instagram, TikTok, X, Telegram, WhatsApp.`
              : "No valid services were provided.",
        },
        error: "no_supported_services",
      };
    }

    return {
      success: true,
      data: {
        surfaced: supported,
        unsupported,
        message: `Connection cards for ${supported.join(", ")} are now shown in the chat. The creator completes each one in the dashboard.`,
      },
    };
  },
});

registerTool({
  name: "disconnect_connections",
  deferred: true,
  description: `Disconnect a connected app/account the creator no longer wants Indyfren to access (revokes Indyfren's access). Use when the creator asks to disconnect, unlink, or revoke an app. Supported: ${SUPPORTED_LIST}. Pass \`services\` as a comma-separated list.`,
  autonomyLevel: "autonomous",
  costCategory: "free",
  maxCostPerUseCents: 0,
  parameters: {
    services: {
      type: "string",
      description: `Comma-separated services to disconnect, e.g. "gmail, notion". Supported: ${SUPPORTED_LIST}.`,
      required: true,
    },
  },
  execute: async (params, context): Promise<ToolResult> => {
    const { supported, unsupported } = parseConnectionTargets(params.services);
    // Only Composio-backed toolkits can be revoked server-side here.
    const removable = supported.filter(isComposioToolkit);
    const notRemovable = supported.filter((s) => !isComposioToolkit(s));

    if (removable.length === 0) {
      return {
        success: false,
        data: {
          message:
            "Nothing to disconnect there. Telegram/WhatsApp are managed in Settings → Channels.",
          unsupported: [...unsupported, ...notRemovable],
        },
        error: "no_removable_services",
      };
    }

    const results: Array<{ toolkit: string; disconnected: number }> = [];
    for (const toolkit of removable) {
      const disconnected = await disconnectComposioToolkit(
        context.creatorId,
        toolkit,
      );
      results.push({ toolkit, disconnected });
    }

    const done = results
      .filter((r) => r.disconnected > 0)
      .map((r) => r.toolkit);
    const none = results
      .filter((r) => r.disconnected === 0)
      .map((r) => r.toolkit);

    return {
      success: true,
      data: {
        results,
        message:
          (done.length > 0 ? `Disconnected ${done.join(", ")}. ` : "") +
          (none.length > 0
            ? `No active connection found for ${none.join(", ")}. `
            : "") +
          (notRemovable.length > 0
            ? `${notRemovable.join(", ")} are managed in Settings → Channels.`
            : ""),
      },
    };
  },
});
