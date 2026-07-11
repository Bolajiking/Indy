/**
 * Composio — connector backbone.
 *
 * Composio handles the OAuth flows + token storage for many third-party apps
 * (Gmail, Slack, Notion, Calendar, …). We use it as the scalable alternative to
 * hand-wiring each provider: enable a toolkit by creating an auth config in the
 * Composio dashboard and mapping toolkit → authConfigId in COMPOSIO_AUTH_CONFIGS.
 *
 * The whole module is inert unless COMPOSIO_API_KEY is set, so the app runs
 * unchanged without Composio configured.
 */

import { Composio } from "@composio/core";
import type Anthropic from "@anthropic-ai/sdk";
import pino from "#logger";
import { incrementMetric } from "../observability/metrics.js";
import { env } from "../config/env.js";
import { isJsonObject, isRecord, type JsonObject } from "../db/json.js";
import { serializeToolResult } from "../agent/tool-result.js";

// Default number of tool schemas returned by one get_app_tools call. The
// schemas live in conversation (not the system prompt), so this caps the cost
// of a single discovery step, not the resident prompt size.
const DEFAULT_APP_TOOLS = 20;
// Max matches returned by one search_app_actions call over the full catalog.
const MAX_SEARCH_RESULTS = 10;

// Re-exported so connected-app results are clamped to a model-safe size before
// re-entering the loop (see ../agent/tool-result for the rationale + behaviour).
export { serializeToolResult };

const log = pino({ name: "integrations:composio" });

let clientPromise: Promise<Composio> | null = null;
let authConfigs: Record<string, string> | null = null;

type JsonSchemaProperty = {
  type?: string;
  description?: string;
  enum?: unknown[];
  items?: { type?: unknown };
};

type JsonSchemaObject = {
  type?: string;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
};

type SlimJsonSchemaProperty = {
  type: string;
  description?: string;
  enum?: unknown[];
  items?: { type: string };
};

interface ComposioExecuteResponse {
  data?: unknown;
  error?: unknown;
  successful?: boolean;
}

export function isComposioEnabled(): boolean {
  return env.COMPOSIO_API_KEY.trim().length > 0;
}

function getAuthConfigs(): Record<string, string> {
  if (authConfigs) return authConfigs;
  try {
    const parsed = JSON.parse(env.COMPOSIO_AUTH_CONFIGS || "{}") as unknown;
    const configs: Record<string, string> = {};
    if (isJsonObject(parsed)) {
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === "string" && value.length > 0) {
          configs[key.toLowerCase()] = value;
        }
      }
    }
    authConfigs = configs;
  } catch (error) {
    log.error({ error }, "COMPOSIO_AUTH_CONFIGS is not valid JSON; ignoring");
    authConfigs = {};
  }
  return authConfigs ?? {};
}

// Composio requires a *concrete* toolkit version for manual tool execution
// ("latest" is rejected). Resolve each configured toolkit's latest version once
// and construct the client pinned to those versions. Memoized.
async function buildClient(): Promise<Composio> {
  const apiKey = env.COMPOSIO_API_KEY;
  const boot = new Composio({ apiKey });
  const toolkitVersions: Record<string, string> = {};
  for (const slug of Object.keys(getAuthConfigs())) {
    try {
      const toolkit = (await boot.toolkits.get(slug)) as {
        meta?: { availableVersions?: string[] };
      };
      const latest = toolkit.meta?.availableVersions?.[0];
      if (latest) toolkitVersions[slug] = latest;
    } catch (error) {
      log.warn({ slug }, "Could not resolve Composio toolkit version");
    }
  }
  return new Composio({ apiKey, toolkitVersions });
}

function getClient(): Promise<Composio> {
  if (!isComposioEnabled()) {
    return Promise.reject(
      new Error("Composio is not configured (COMPOSIO_API_KEY missing)"),
    );
  }
  if (!clientPromise) {
    clientPromise = buildClient().catch((error) => {
      clientPromise = null; // allow retry on next call
      throw error;
    });
  }
  return clientPromise;
}

/** Toolkit slugs that have an auth config and can therefore be connected. */
export function getComposioToolkits(): string[] {
  if (!isComposioEnabled()) return [];
  return Object.keys(getAuthConfigs());
}

export function isComposioToolkit(toolkit: string): boolean {
  return getComposioToolkits().includes(toolkit.toLowerCase());
}

/**
 * Connected-app state for prompt context, categorized. Used by assembleContext
 * so EVERY agent prompt (orchestrator + all skills) shares one truthful view of
 * which apps are connected — never contradicting the per-run connected-apps note
 * or claiming an app isn't connected when it is. Never throws.
 */
export async function getConnectedAppsForContext(
  userId: string,
): Promise<{ connected: string[]; reconnect: string[] }> {
  if (!isComposioEnabled()) return { connected: [], reconnect: [] };
  try {
    const all = await listComposioConnections(userId);
    const connected = [
      ...new Set(all.filter((c) => c.connected).map((c) => c.toolkit)),
    ];
    const reconnect = [
      ...new Set(all.filter((c) => !c.connected).map((c) => c.toolkit)),
    ].filter((t) => !connected.includes(t));
    return { connected, reconnect };
  } catch (error) {
    log.warn({ userId }, "Failed to load connected apps for context");
    return { connected: [], reconnect: [] };
  }
}

/**
 * Start an OAuth/connect flow for a creator + toolkit. Returns the redirect URL
 * the dashboard sends the user to. Composio handles consent + token storage.
 */
export async function initiateComposioConnection(
  userId: string,
  toolkit: string,
  callbackUrl: string,
): Promise<{ redirectUrl: string }> {
  const slug = toolkit.toLowerCase();
  const authConfigId = getAuthConfigs()[slug];
  if (!authConfigId) {
    throw new Error(`No Composio auth config for toolkit "${toolkit}"`);
  }

  const client = await getClient();

  // Clean up dead/half-finished records for this toolkit before starting a new
  // flow. Because we link with allowMultiple, every abandoned attempt leaves a
  // stale INITIATED/EXPIRED/FAILED record behind — these pile up and make the
  // toolkit look perpetually "expired". We delete only non-ACTIVE records, so a
  // working connection is never disturbed by a reconnect attempt.
  try {
    const existing = await client.connectedAccounts.list({ userIds: [userId] });
    const stale = existing.items.filter(
      (i) => i.toolkit.slug.toLowerCase() === slug && i.status !== "ACTIVE",
    );
    await Promise.all(
      stale.map((i) =>
        client.connectedAccounts
          .delete(i.id)
          .catch((error) =>
            log.warn({ slug, id: i.id }, "Stale connection cleanup failed"),
          ),
      ),
    );
  } catch (error) {
    log.warn({ slug }, "Could not enumerate connections for cleanup");
  }

  // `link` is the current flow for both Composio-managed and custom OAuth
  // auth configs (the older `initiate` is rejected for managed configs).
  // allowMultiple lets a creator (re)connect even if a connection already
  // exists for this toolkit — e.g. reconnecting to grant new scopes.
  const response = await client.connectedAccounts.link(userId, authConfigId, {
    callbackUrl,
    allowMultiple: true,
  });
  invalidateConnectionsCache(userId);

  if (!response.redirectUrl) {
    throw new Error(
      `Composio did not return a redirect URL for "${toolkit}" — the auth config may not be an OAuth flow`,
    );
  }

  return { redirectUrl: response.redirectUrl };
}

export interface ComposioConnection {
  toolkit: string;
  status: string;
  connected: boolean;
}

// Short-TTL cache of a creator's connections. Within a single message we hit
// this list several times (context assembly, routing, tool loading); without a
// cache that's redundant Composio calls + latency. The TTL is short so a connect
// / disconnect reflects quickly, and both mutations invalidate the entry.
const CONNECTIONS_TTL_MS = 15_000;
const connectionsCache = new Map<
  string,
  { at: number; value: ComposioConnection[] }
>();

/** Drop the cached connections for a creator (call after connect/disconnect). */
function invalidateConnectionsCache(userId: string): void {
  connectionsCache.delete(userId);
}

/**
 * Composio connections for a creator, deduped to one row per toolkit.
 *
 * `allowMultiple: true` on (re)connect means a toolkit can accrue several
 * account records (e.g. an old EXPIRED one plus a fresh ACTIVE one). We collapse
 * them per toolkit, preferring an ACTIVE connection — so both the Settings UI
 * and the agent see a single, truthful status per app.
 */
export async function listComposioConnections(
  userId: string,
): Promise<ComposioConnection[]> {
  if (!isComposioEnabled()) return [];

  const cached = connectionsCache.get(userId);
  if (cached && Date.now() - cached.at < CONNECTIONS_TTL_MS) {
    return cached.value;
  }

  const response = await (
    await getClient()
  ).connectedAccounts.list({
    userIds: [userId],
  });

  const byToolkit = new Map<string, ComposioConnection>();
  for (const item of response.items) {
    const toolkit = item.toolkit.slug.toLowerCase();
    const conn: ComposioConnection = {
      toolkit,
      status: item.status,
      connected: item.status === "ACTIVE",
    };
    const existing = byToolkit.get(toolkit);
    // Keep the first record per toolkit, but always let an ACTIVE one win.
    if (!existing || (conn.connected && !existing.connected)) {
      byToolkit.set(toolkit, conn);
    }
  }

  const value = [...byToolkit.values()];
  connectionsCache.set(userId, { at: Date.now(), value });
  return value;
}

/** Disconnect all of a creator's connected accounts for a toolkit. Returns count. */
export async function disconnectComposioToolkit(
  userId: string,
  toolkit: string,
): Promise<number> {
  if (!isComposioEnabled()) return 0;
  const client = await getClient();
  const res = await client.connectedAccounts.list({ userIds: [userId] });
  const matches = res.items.filter(
    (i) => i.toolkit.slug.toLowerCase() === toolkit.toLowerCase(),
  );

  let removed = 0;
  for (const account of matches) {
    try {
      await client.connectedAccounts.delete(account.id);
      removed += 1;
    } catch (error) {
      log.warn({ toolkit, accountId: account.id }, "Disconnect failed");
    }
  }
  if (removed > 0) invalidateConnectionsCache(userId);
  return removed;
}

/** Revoke every Composio account belonging to a creator during account cleanup. */
export async function disconnectAllComposioConnections(
  userId: string,
): Promise<number> {
  if (!isComposioEnabled()) return 0;
  const client = await getClient();
  const response = await client.connectedAccounts.list({ userIds: [userId] });
  let removed = 0;
  for (const account of response.items) {
    await client.connectedAccounts.delete(account.id);
    removed += 1;
  }
  invalidateConnectionsCache(userId);
  return removed;
}

/* ──────────────────────────────────────────────────────────────────────────
   Action tools — let the agent actually use connected apps (read Gmail, post
   to Slack, …). Exposed to the agent loop as dynamic tools and executed by slug.
   ────────────────────────────────────────────────────────────────────────── */

// Minimal shape we read off Composio's tool list, defensive across SDK formats.
interface RawComposioTool {
  slug?: string;
  name?: string;
  description?: string;
  isDeprecated?: boolean;
  inputParameters?: JsonSchemaObject;
  function?: {
    name?: string;
    description?: string;
    parameters?: JsonSchemaObject;
  };
}

// Composio ships very verbose schemas — long descriptions plus per-parameter
// docs with examples/defaults. The full set for one creator is ~17k tokens,
// resent on every LLM call, which alone can blow a low TPM budget. We slim each
// tool to what the model needs to call it correctly: a short description, and
// per-property {type, short description, enum, item type} — dropping examples,
// defaults, and deep nesting. Keeps tool-calling accurate at a fraction of the
// token cost.
const MAX_TOOL_DESC_CHARS = 220;
const MAX_PROP_DESC_CHARS = 100;

function readSchemaProperty(prop: unknown): JsonSchemaProperty | null {
  if (!isRecord(prop)) return null;

  return {
    ...(typeof prop.type === "string" ? { type: prop.type } : {}),
    ...(typeof prop.description === "string"
      ? { description: prop.description }
      : {}),
    ...(Array.isArray(prop.enum) ? { enum: prop.enum } : {}),
    ...(isRecord(prop.items) ? { items: prop.items } : {}),
  };
}

function slimSchemaProperty(prop: unknown): SlimJsonSchemaProperty {
  const p = readSchemaProperty(prop);
  if (!prop || typeof prop !== "object") return { type: "string" };
  const out: SlimJsonSchemaProperty = { type: "string" };
  if (p?.type) out.type = p.type;
  if (p?.description) {
    out.description = p.description.slice(0, MAX_PROP_DESC_CHARS);
  }
  if (p?.enum) out.enum = p.enum.slice(0, 20);
  if (p?.items) {
    out.items =
      typeof p.items.type === "string"
        ? { type: p.items.type }
        : { type: "string" };
  }
  return out;
}

function slimSchema(schema: JsonSchemaObject): Anthropic.Tool.InputSchema {
  const properties: Record<string, SlimJsonSchemaProperty> = {};
  for (const [key, value] of Object.entries(schema.properties ?? {})) {
    properties[key] = slimSchemaProperty(value);
  }
  return {
    type: "object",
    properties,
    ...(Array.isArray(schema.required) && schema.required.length > 0
      ? { required: schema.required }
      : {}),
  } satisfies Anthropic.Tool.InputSchema;
}

function toAnthropicTool(raw: RawComposioTool): Anthropic.Tool | null {
  const slug = raw.slug ?? raw.name ?? raw.function?.name;
  if (!slug) return null;
  const description = (
    raw.description ??
    raw.function?.description ??
    ""
  ).slice(0, MAX_TOOL_DESC_CHARS);
  const schema = raw.inputParameters ??
    raw.function?.parameters ?? { type: "object", properties: {} };
  return {
    name: slug,
    description,
    input_schema: slimSchema(schema),
  };
}

function isRawComposioTool(value: unknown): value is RawComposioTool {
  return isRecord(value);
}

function readRawComposioTools(value: unknown): RawComposioTool[] {
  if (Array.isArray(value)) {
    return value.filter(isRawComposioTool);
  }

  if (isRecord(value) && Array.isArray(value.items)) {
    return value.items.filter(isRawComposioTool);
  }

  return [];
}

function readComposioExecuteResponse(value: unknown): ComposioExecuteResponse {
  return isRecord(value) ? value : { data: value };
}

// Read-only action verbs — everything else is treated as a write (and gated
// behind approval), so an unrecognised/destructive action never runs silently.
const READ_VERB =
  /_(GET|FETCH|LIST|SEARCH|READ|RETRIEVE|FIND|COUNT|CHECK|VIEW|STATISTICS|DETAILS|DOWNLOAD|LOAD)/i;
// Mutation precedence is intentional: compound actions such as
// GET_OR_CREATE and FIND_OR_UPDATE still change external state and must never
// become autonomous merely because their slug also contains a read verb.
const WRITE_VERB =
  /(?:^|_)(CREATE|SEND|UPDATE|PATCH|DELETE|REMOVE|TRASH|POST|REPLY|DRAFT|UPLOAD|MOVE|SUBSCRIBE|UNSUBSCRIBE|MARK|SET|PUT|WRITE|MODIFY|ARCHIVE|INVITE|PUBLISH)(?:_|$)/i;

/** True if a Composio tool slug mutates the connected account (send/create/…). */
export function isComposioWriteSlug(slug: string): boolean {
  if (WRITE_VERB.test(slug)) return true;
  return !READ_VERB.test(slug);
}

// Core write verbs a creator's manager actually needs (send a pitch, reply,
// draft, post a comment, upload). These must survive the cap alongside reads.
const USEFUL_WRITE_VERB =
  /_(SEND|CREATE|POST|REPLY|DRAFT|UPLOAD|ADD_VIDEO|MOVE|SUBSCRIBE)/i;
// Obscure / admin / housekeeping actions creators don't need — CSE keypairs,
// forwarding & vacation settings, filters, i18n, moderation, captions, etc.
// Demoted so they never crowd out core reads (analytics) or core writes (send).
const OBSCURE_VERB =
  /(CSE|KEYPAIR|FORWARDING|DELEGATE|SEND_AS|VACATION|AUTO_?FORWARD|IMAP|POP|IDENTITIES|FILTER|LANGUAGE_SETTING|I18N|REGION|ABUSE|MODERATION|SUPER_CHAT|LIVE_CHAT|CAPTION|WATERMARK|VIDEO_CATEGOR|CHANNEL_SECTION|HISTORY|SPAM|RATE_VIDEO|REPORT|_ACL_|SETTING|PERMISSION|REVISION|_WATCH|_ABOUT|START_PAGE_TOKEN|_APP$|_APPS_|CHANGES_START|COLOR|FREEBUSY_QUERY_NONE)/i;
const DESTRUCTIVE_VERB = /_(DELETE|REMOVE|TRASH|UNSUBSCRIBE|MARK)/i;

/**
 * Select a fair, useful subset of a toolkit's full action catalog under a cap.
 * The catalog can have 40+ actions; sending all of them is too many tokens, but
 * a naive "reads first" sort buries critical writes (GMAIL_SEND_EMAIL) under
 * obscure admin reads (GMAIL_LIST_CSE_KEYPAIRS). We instead guarantee a mix:
 * core reads (analytics/lists/fetches) get the majority of slots, core writes
 * get a reserved share, obscure/destructive actions are filled in last only if
 * room remains. Keeps both "show my channel stats" and "send this pitch" working.
 */
export function selectToolkitTools(
  raw: RawComposioTool[],
  limit: number,
): RawComposioTool[] {
  const slugOf = (t: RawComposioTool) => t.slug ?? t.name ?? "";
  const valid = raw.filter((t) => !t.isDeprecated && slugOf(t).length > 0);

  const coreReads: RawComposioTool[] = [];
  const coreWrites: RawComposioTool[] = [];
  const rest: RawComposioTool[] = [];
  for (const t of valid) {
    const slug = slugOf(t);
    if (OBSCURE_VERB.test(slug) || DESTRUCTIVE_VERB.test(slug)) {
      rest.push(t);
    } else if (READ_VERB.test(slug)) {
      coreReads.push(t);
    } else if (USEFUL_WRITE_VERB.test(slug)) {
      coreWrites.push(t);
    } else {
      rest.push(t);
    }
  }

  // Reserve ~65% of slots for reads, the remainder for core writes, then fill
  // any leftover capacity with whatever remains (rest, then extra reads/writes).
  const readQuota = Math.min(coreReads.length, Math.ceil(limit * 0.65));
  const picked: RawComposioTool[] = [
    ...coreReads.slice(0, readQuota),
    ...coreWrites.slice(0, limit - readQuota),
  ];
  if (picked.length < limit) {
    const have = new Set(picked.map(slugOf));
    for (const t of [...coreReads, ...coreWrites, ...rest]) {
      if (picked.length >= limit) break;
      if (!have.has(slugOf(t))) {
        have.add(slugOf(t));
        picked.push(t);
      }
    }
  }
  return picked.slice(0, limit);
}

// Result keys that signal something went wrong inside an otherwise-"successful"
// response — surfaced to the top so the agent can't miss them in a large payload.
const ISSUE_KEY =
  /^(error|errors|failed|failure|failures|warning|warnings|rejected|invalid|denied)$/i;
const MAX_ISSUES = 5;
const MAX_ISSUE_CHARS = 160;

function collectResultIssues(
  value: unknown,
  path = "",
  depth = 0,
  found: string[] = [],
): string[] {
  if (found.length >= MAX_ISSUES || depth > 4 || !isRecord(value)) return found;
  for (const [key, entry] of Object.entries(value)) {
    if (found.length >= MAX_ISSUES) break;
    const entryPath = path ? `${path}.${key}` : key;
    const isEmpty =
      entry == null ||
      entry === "" ||
      entry === false ||
      (Array.isArray(entry) && entry.length === 0);
    if (ISSUE_KEY.test(key) && !isEmpty) {
      found.push(
        `${entryPath}: ${JSON.stringify(entry).slice(0, MAX_ISSUE_CHARS)}`,
      );
    } else if (isRecord(entry)) {
      collectResultIssues(entry, entryPath, depth + 1, found);
    } else if (Array.isArray(entry)) {
      for (const item of entry.slice(0, 10)) {
        collectResultIssues(item, entryPath, depth + 1, found);
        if (found.length >= MAX_ISSUES) break;
      }
    }
  }
  return found;
}

/**
 * Triaged feedback for a connected-app action: outcome header, buried issues
 * pulled to the top, then the clamped payload. "Here's what happened, and
 * here's the part that looks wrong" — not just a raw JSON dump. Write actions
 * with empty responses get an explicit verification warning so the agent never
 * tells the creator something was done without evidence.
 */
export function triageAppToolResult(
  slug: string,
  outcome: { success: boolean; data: unknown },
): string {
  const lines = [`ACTION ${slug}: ${outcome.success ? "completed" : "FAILED"}`];

  const issues = outcome.success ? collectResultIssues(outcome.data) : [];
  if (issues.length > 0) {
    lines.push("NEEDS REVIEW — the response reports problems:");
    for (const issue of issues) lines.push(`- ${issue}`);
  }

  const isEmptyData =
    outcome.data == null ||
    outcome.data === "" ||
    (isRecord(outcome.data) && Object.keys(outcome.data).length === 0);
  if (outcome.success && isEmptyData && isComposioWriteSlug(slug)) {
    lines.push(
      "NOTE: empty response for a write action — verify it actually took effect before telling the creator it's done.",
    );
  }

  lines.push(serializeToolResult(outcome.data));
  return lines.join("\n");
}

/** Execute a Composio tool by slug for a user. Used directly + after approval. */
export async function executeComposioToolBySlug(
  userId: string,
  slug: string,
  input: JsonObject,
): Promise<{ success: boolean; data: unknown }> {
  const res = readComposioExecuteResponse(
    await (
      await getClient()
    ).tools.execute(slug, {
      userId,
      arguments: input,
    }),
  );
  const success = res.successful !== false && !res.error;
  return { success, data: success ? (res.data ?? res) : (res.error ?? res) };
}

/** The agent-loop config fragment for a creator's connected-app tools. */
export interface ComposioLoopTools {
  dynamicTools?: Anthropic.Tool[];
  executeDynamicTool?: (
    name: string,
    input: JsonObject,
  ) => Promise<{ content: string; isError: boolean } | null>;
  dynamicToolNeedsApproval?: (name: string, input: JsonObject) => boolean;
  /** Connected-apps summary injected into the prompt so the agent always knows
   *  what it has access to. */
  systemPromptSuffix?: string;
}

function buildConnectionsNote(
  connected: string[],
  reconnect: string[],
  available: string[],
): string {
  const lines = ["\n\n## Connected apps"];
  lines.push(
    connected.length > 0
      ? `Connected — you can act on these now via their tools: ${connected.join(", ")}.`
      : "Connected: none yet.",
  );
  if (connected.length > 0) {
    lines.push(
      "To act on a connected app: call get_app_tools(app) once to load its most-used tools, then execute_app_tool(slug, arguments). " +
        "If the loaded list doesn't cover what you need, call search_app_actions(app, query) — the full catalog has hundreds of actions. " +
        "NEVER claim an action doesn't exist or that you lack access without searching the catalog first.",
    );
  }
  if (reconnect.length > 0) {
    lines.push(
      `Needs reconnect — the creator connected these before but the link expired or was revoked, so the tools are unavailable right now: ${reconnect.join(", ")}. ` +
        "If they ask you to use one, do NOT say you were never connected or that you lack access — explain the connection expired and call request_connections to surface a reconnect card so they can re-authorize in one click.",
    );
  }
  if (available.length > 0) {
    lines.push(
      `Available to connect (offer, then call request_connections): ${available.join(", ")}.`,
    );
  }
  lines.push(
    "When the creator asks what's connected or what you can access, answer from these lists. Never claim you lack access to an app that is listed as Connected.",
  );
  return lines.join("\n");
}

/* ──────────────────────────────────────────────────────────────────────────
   Tool catalog access — context as a cache hierarchy.

   Connected-app tool schemas are NOT resident in the prompt. The prompt holds
   three small meta-tools (L2 discovery + L3 escape hatch):
     - get_app_tools(app)            → the ~20 most-used tools for an app
     - search_app_actions(app, q)    → keyword search over the FULL catalog
     - execute_app_tool(slug, args)  → run an action (refuses unfetched slugs)
   A task that never touches a connected app pays ~3 schemas instead of 40,
   and the long tail of catalog actions is reachable instead of capped away.
   ────────────────────────────────────────────────────────────────────────── */

// The raw per-toolkit catalog is user-independent and changes rarely — cache it
// so discovery calls don't refetch 200 schemas from Composio each time.
const CATALOG_TTL_MS = 10 * 60 * 1000;
const catalogCache = new Map<
  string,
  { at: number; tools: RawComposioTool[] }
>();

async function getToolkitCatalog(toolkit: string): Promise<RawComposioTool[]> {
  const cached = catalogCache.get(toolkit);
  if (cached && Date.now() - cached.at < CATALOG_TTL_MS) return cached.tools;

  const client = await getClient();
  const rawResult = (await client.tools.getRawComposioTools({
    toolkits: [toolkit],
    limit: 200,
  })) as unknown;
  const tools = readRawComposioTools(rawResult).filter((t) => !t.isDeprecated);
  catalogCache.set(toolkit, { at: Date.now(), tools });
  return tools;
}

function catalogSlug(tool: RawComposioTool): string {
  return tool.slug ?? tool.name ?? tool.function?.name ?? "";
}

/** Keyword search over a toolkit's full catalog (slug + description). */
export function searchCatalog(
  catalog: RawComposioTool[],
  query: string,
  limit = MAX_SEARCH_RESULTS,
): RawComposioTool[] {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
  if (terms.length === 0) return [];

  const scored = catalog
    .map((tool) => {
      const slug = catalogSlug(tool).toLowerCase();
      const desc = (
        tool.description ??
        tool.function?.description ??
        ""
      ).toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (slug.includes(term)) score += 2;
        else if (desc.includes(term)) score += 1;
      }
      return { tool, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => s.tool);
}

const META_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_app_tools",
    description:
      "Load the callable tools for one of the creator's connected apps (e.g. gmail, googlecalendar, notion). Returns the most-used tool schemas for that app. You MUST load an app's tools (via this or search_app_actions) before calling execute_app_tool.",
    input_schema: {
      type: "object",
      properties: {
        app: {
          type: "string",
          description: 'Connected app slug, e.g. "gmail".',
        },
      },
      required: ["app"],
    },
  },
  {
    name: "search_app_actions",
    description:
      "Keyword-search the FULL action catalog of a connected app (hundreds of actions) when get_app_tools didn't include what you need. Never assume an action doesn't exist without searching here first.",
    input_schema: {
      type: "object",
      properties: {
        app: {
          type: "string",
          description: 'Connected app slug, e.g. "gmail".',
        },
        query: {
          type: "string",
          description: 'Keywords, e.g. "vacation responder" or "label".',
        },
      },
      required: ["app", "query"],
    },
  },
  {
    name: "execute_app_tool",
    description:
      "Execute a connected-app action by its slug (e.g. GMAIL_FETCH_EMAILS) with that action's arguments. The slug must come from a get_app_tools or search_app_actions result in this conversation.",
    input_schema: {
      type: "object",
      properties: {
        slug: {
          type: "string",
          description: "Action slug from get_app_tools / search_app_actions.",
        },
        arguments: {
          type: "object",
          description: "Arguments matching the action's input schema.",
        },
      },
      required: ["slug", "arguments"],
    },
  },
];

function describeTool(tool: RawComposioTool): {
  slug: string;
  description: string;
  input_schema: Anthropic.Tool.InputSchema;
} | null {
  const asTool = toAnthropicTool(tool);
  if (!asTool) return null;
  return {
    slug: asTool.name,
    description: asTool.description ?? "",
    input_schema: asTool.input_schema,
  };
}

/**
 * Build the loop fragment that exposes a creator's connected-app capability AND
 * a connected-apps summary (so the agent always knows what it can access). Used
 * by every loop entry point — orchestrator, skills, approval re-entry. Returns
 * {} only when Composio is disabled or the lookup fails — so it never blocks.
 */
export async function composioLoopTools(
  userId: string,
): Promise<ComposioLoopTools> {
  if (!isComposioEnabled()) return {};

  let connected: string[];
  let reconnect: string[];
  try {
    const all = await listComposioConnections(userId);
    connected = [
      ...new Set(all.filter((c) => c.connected).map((c) => c.toolkit)),
    ];
    reconnect = [
      ...new Set(all.filter((c) => !c.connected).map((c) => c.toolkit)),
    ].filter((t) => !connected.includes(t));
  } catch (error) {
    incrementMetric("external_provider_health_total", {
      provider: "composio",
      outcome: "error",
    });
    log.warn({ userId }, "Failed to load Composio connections");
    return {};
  }

  const available = getComposioToolkits().filter(
    (t) => !connected.includes(t) && !reconnect.includes(t),
  );
  const systemPromptSuffix = buildConnectionsNote(
    connected,
    reconnect,
    available,
  );

  // No active connections yet → still tell the agent what's connected/expired/
  // available so it can guide the creator (e.g. reconnect an expired Gmail).
  if (connected.length === 0) return { systemPromptSuffix };

  const connectedSet = new Set(connected);
  // Slugs the model has loaded this run. execute_app_tool refuses anything not
  // in here, so the model always sees an action's schema before calling it.
  const fetched = new Set<string>();

  const executeDynamicTool: ComposioLoopTools["executeDynamicTool"] = async (
    name,
    input,
  ) => {
    if (name === "get_app_tools" || name === "search_app_actions") {
      const app = String(input.app ?? "").toLowerCase();
      if (!connectedSet.has(app)) {
        return {
          content: `"${app}" is not a connected app. Connected: ${connected.join(", ")}.`,
          isError: true,
        };
      }
      let catalog: RawComposioTool[];
      try {
        catalog = await getToolkitCatalog(app);
      } catch (error) {
        log.warn({ app, userId }, "Failed to load toolkit catalog");
        return {
          content: `Could not load the ${app} catalog right now — try again.`,
          isError: true,
        };
      }

      const picked =
        name === "get_app_tools"
          ? selectToolkitTools(catalog, DEFAULT_APP_TOOLS)
          : searchCatalog(catalog, String(input.query ?? ""));

      const described = picked
        .map(describeTool)
        .filter((t): t is NonNullable<typeof t> => t !== null);
      for (const t of described) fetched.add(t.slug);

      if (described.length === 0) {
        return {
          content:
            name === "search_app_actions"
              ? `No ${app} actions matched "${String(input.query ?? "")}". Try different keywords — the catalog has ${catalog.length} actions.`
              : `No callable tools found for ${app}.`,
          isError: false,
        };
      }
      const note =
        name === "get_app_tools" && catalog.length > described.length
          ? `\n(${catalog.length - described.length} more actions exist — use search_app_actions to find them.)`
          : "";
      return {
        content: JSON.stringify(described) + note,
        isError: false,
      };
    }

    if (name === "execute_app_tool") {
      const slug = String(input.slug ?? "");
      if (!fetched.has(slug)) {
        return {
          content: `Unknown or unloaded action "${slug}". Call get_app_tools or search_app_actions first to load its schema, then retry.`,
          isError: true,
        };
      }
      const args = isJsonObject(input.arguments) ? input.arguments : {};
      const outcome = await executeComposioToolBySlug(userId, slug, args);
      // Triaged + clamped before the result re-enters the loop: outcome header,
      // buried errors surfaced, payload clamped to a model-safe size.
      return {
        content: triageAppToolResult(slug, outcome),
        isError: !outcome.success,
      };
    }

    return null;
  };

  return {
    systemPromptSuffix,
    dynamicTools: META_TOOLS,
    executeDynamicTool,
    dynamicToolNeedsApproval: (name, input) =>
      name === "execute_app_tool" &&
      isComposioWriteSlug(String(input.slug ?? "")),
  };
}
