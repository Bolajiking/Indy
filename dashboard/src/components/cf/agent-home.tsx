"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  approveAgentAction,
  createMessagingLink,
  fetchAgentState,
  fetchConnectionsInfo,
  initiateConnection,
  sendAgentMessage,
  skipAgentAction,
  startPlatformOAuth,
  type DashboardAgentState,
  type DashboardConnectionsInfo,
  type DashboardMessagingLink,
  type DashboardMessagingPlatform,
  type DashboardPendingApproval,
} from "@/lib/api";
import { canAccessCreatorData } from "@/lib/auth-state";
import {
  clearPendingConnectionToolkit,
  clearRecentConnectionSuccess,
  readRecentConnectionSuccess,
  resolveConnectionCardState,
  writePendingConnectionToolkit,
  type ConnectionAccountLike,
} from "@/lib/connection-success";
import { broadcastDealsChanged } from "@/lib/deals-sync";
import { useAuth } from "@/lib/auth-context";
import { useAuthedQuery } from "@/lib/use-authed-query";
import {
  BrandGlyph,
  Icon,
  LogoBadge,
  FrenBadge,
  TypingDots,
  mdBold,
} from "./primitives";
import { useShell } from "./shell-context";

// How each service connects:
//  - oauth   → first-party platform OAuth (startPlatformOAuth)
//  - channel → Telegram/WhatsApp messaging link (createMessagingLink)
//  - composio→ any toolkit enabled through Composio (initiateConnection)
type ConnectKind = "oauth" | "channel" | "composio";

// Only these have a real first-party path; everything else routes via Composio.
const NATIVE_SERVICES: Record<string, { label: string; kind: ConnectKind }> = {
  youtube: { label: "YouTube", kind: "oauth" },
  telegram: { label: "Telegram", kind: "channel" },
  whatsapp: { label: "WhatsApp", kind: "channel" },
};

// Friendly labels / glyphs for Composio toolkits (others fall back to a
// title-cased slug + a letter badge).
const COMPOSIO_LABELS: Record<string, string> = {
  gmail: "Gmail",
  googlecalendar: "Google Calendar",
  calendar: "Calendar",
  googledrive: "Google Drive",
  slack: "Slack",
  notion: "Notion",
  stripe: "Stripe",
  github: "GitHub",
  linear: "Linear",
  hubspot: "HubSpot",
  instagram: "Instagram",
  tiktok: "TikTok",
  x: "X",
};
const GLYPH_NAME: Record<string, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
  x: "X",
  gmail: "Gmail",
  googlecalendar: "Calendar",
  calendar: "Calendar",
  notion: "Notion",
  stripe: "Stripe",
};

function prettify(slug: string): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

const EMPTY_CONNECTIONS: DashboardConnectionsInfo = {
  enabled: false,
  toolkits: [],
  accounts: [],
};

function serviceMeta(service: string): { label: string; kind: ConnectKind } {
  const native = NATIVE_SERVICES[service];
  if (native) return native;
  return {
    label: COMPOSIO_LABELS[service] ?? prettify(service),
    kind: "composio",
  };
}

function Avatar() {
  return (
    <LogoBadge
      size={34}
      radius={11}
      bg="var(--cf-dark-blue)"
      color="#fff"
      colorB="var(--cf-accent-blue)"
    />
  );
}

type FeedItem =
  | { kind: "user"; id: string; text: string }
  | { kind: "agent"; id: string; text: string }
  | {
      kind: "working";
      id: string;
      skill: string;
      steps: string[];
      stepIdx: number;
    }
  | {
      kind: "approval";
      id: string;
      approval: DashboardPendingApproval;
      state: "pending" | "approved" | "skipped";
      result?: string;
    }
  | { kind: "connect"; id: string; services: string[] };

const WORKING_STEPS = [
  "Reading your request",
  "Pulling your context",
  "Working it through",
];

type MessageMetadata = DashboardAgentState["messages"][number]["metadata"];

function readConnections(metadata: MessageMetadata): string[] {
  const raw = metadata?.connections;
  if (!Array.isArray(raw)) return [];
  // The backend only surfaces validated service slugs, so accept any string.
  return raw.filter((s): s is string => typeof s === "string" && s.length > 0);
}

function buildFeed(state: DashboardAgentState): FeedItem[] {
  const items: FeedItem[] = [];
  for (const m of state.messages) {
    if (m.role === "assistant") {
      items.push({ kind: "agent", id: m.id, text: m.content });
      const services = readConnections(m.metadata);
      if (services.length > 0)
        items.push({ kind: "connect", id: `connect-${m.id}`, services });
    } else items.push({ kind: "user", id: m.id, text: m.content });
  }
  for (const a of state.pendingApprovals)
    items.push({
      kind: "approval",
      id: `appr-${a.id}`,
      approval: a,
      state: "pending",
    });
  return items;
}

// Keep the in-progress state compact; detailed provenance belongs in the final agent reply.
function WorkingView() {
  return (
    <div
      className="rise"
      style={{ display: "flex", gap: 12, alignItems: "center" }}
    >
      <Avatar />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 11,
          background: "rgb(var(--ink) / 0.05)",
          border: "1px solid rgb(var(--ink) / 0.07)",
          borderRadius: 18,
          padding: "14px 18px",
        }}
      >
        <span style={{ fontSize: 14.5, color: "rgb(var(--ink) / 0.72)" }}>
          indyfren is working
        </span>
        <TypingDots />
      </div>
    </div>
  );
}

function DecisionCard({
  approval,
  state,
  result,
  busy,
  onApprove,
  onSkip,
}: {
  approval: DashboardPendingApproval;
  state: "pending" | "approved" | "skipped";
  result?: string;
  busy: boolean;
  onApprove: () => void;
  onSkip: () => void;
}) {
  return (
    <div
      className="on-ink"
      style={{
        background:
          "linear-gradient(160deg, rgba(28,30,54,0.92), rgba(16,17,34,0.94))",
        border: "1px solid rgb(var(--ink) / 0.1)",
        borderRadius: 20,
        padding: 18,
        maxWidth: 520,
        boxShadow: "0 20px 50px -20px rgba(0,0,0,0.6)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "#fff",
            whiteSpace: "nowrap",
            background: "rgb(var(--ink) / 0.1)",
            padding: "4px 9px",
            borderRadius: 99,
          }}
        >
          Needs your approval
        </span>
        <span style={{ fontSize: 12.5, color: "rgb(var(--ink) / 0.5)" }}>
          {approval.type}
        </span>
      </div>
      <div
        style={{
          fontSize: 14.5,
          fontWeight: 600,
          color: "#fff",
          marginBottom: 10,
        }}
      >
        {approval.description}
      </div>
      {approval.preview && (
        <div
          style={{
            background: "rgba(0,0,0,0.25)",
            border: "1px solid rgb(var(--ink) / 0.06)",
            borderRadius: 12,
            padding: 14,
            fontSize: 13.5,
            lineHeight: 1.55,
            color: "rgb(var(--ink) / 0.78)",
            marginBottom: 14,
          }}
        >
          {approval.preview}
        </div>
      )}
      {state === "approved" ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "var(--cf-grad-end)",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {Icon.check({ size: 18, color: "var(--cf-grad-end)" })}{" "}
          {result ?? "Done — Indyfren ran it."}
        </div>
      ) : state === "skipped" ? (
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "rgb(var(--ink) / 0.5)",
          }}
        >
          Skipped — I&apos;ll hold off.
        </div>
      ) : (
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onApprove}
            disabled={busy}
            style={{
              flex: 1,
              height: 46,
              borderRadius: 99,
              border: "none",
              background: "var(--cf-mint)",
              color: "#0c2412",
              fontWeight: 700,
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              whiteSpace: "nowrap",
              opacity: busy ? 0.6 : 1,
            }}
          >
            {Icon.check({ size: 17, color: "#0c2412" })}{" "}
            {busy ? "Working…" : "Approve & run"}
          </button>
          <button
            onClick={onSkip}
            disabled={busy}
            style={{
              flex: "none",
              padding: "0 22px",
              height: 46,
              borderRadius: 99,
              background: "rgb(var(--ink) / 0.06)",
              color: "rgb(var(--ink) / 0.8)",
              fontWeight: 600,
              fontSize: 14,
              border: "1px solid rgb(var(--ink) / 0.1)",
              opacity: busy ? 0.6 : 1,
            }}
          >
            Skip
          </button>
        </div>
      )}
    </div>
  );
}

function ConnectGlyph({ service }: { service: string }) {
  if (service === "telegram" || service === "whatsapp") {
    const color = service === "telegram" ? "#27A7E7" : "#25D366";
    const letter = service === "telegram" ? "T" : "W";
    return (
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 11,
          background: color,
          display: "grid",
          placeItems: "center",
          flex: "none",
          fontWeight: 800,
          color: "#fff",
        }}
      >
        {letter}
      </div>
    );
  }
  const name =
    GLYPH_NAME[service] ?? COMPOSIO_LABELS[service] ?? prettify(service);
  return <BrandGlyph name={name} size={40} />;
}

function ConnectCard({
  service,
  accessToken,
  accounts,
  recentSuccessToolkit,
  onOpenSettings,
}: {
  service: string;
  accessToken: string | null;
  accounts: ConnectionAccountLike[];
  recentSuccessToolkit: string | null;
  onOpenSettings: () => void;
}) {
  const meta = serviceMeta(service);
  const { creator } = useAuth();
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<DashboardMessagingLink | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Live state so the card always reflects reality: a card in old chat history
  // shows "Connected" once linked, and flips to success right after OAuth.
  const channelLinked =
    meta.kind === "channel" &&
    Boolean(
      service === "telegram"
        ? creator?.telegram_chat_id
        : creator?.whatsapp_phone,
    );
  const connState =
    meta.kind === "channel"
      ? null
      : resolveConnectionCardState(service, accounts, recentSuccessToolkit);
  const connected = channelLinked || Boolean(connState?.confirmedConnected);
  const finalizing = Boolean(connState?.recentlySuccessful);

  async function go() {
    if (!accessToken) {
      onOpenSettings();
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      if (meta.kind === "channel") {
        const created = await createMessagingLink(
          accessToken,
          service as DashboardMessagingPlatform,
        );
        setLink(created);
      } else if (meta.kind === "composio") {
        // Record the attempt (and that it started in chat) so the OAuth return
        // can surface success here even if the callback loses its params.
        writePendingConnectionToolkit(service, "chat");
        const redirectUrl = await initiateConnection(
          accessToken,
          service,
          "chat",
        );
        window.location.assign(redirectUrl);
      } else {
        writePendingConnectionToolkit(service, "chat");
        const url = await startPlatformOAuth(accessToken, service);
        window.location.assign(url);
      }
    } catch {
      clearPendingConnectionToolkit(service);
      setErr(
        `Couldn't start the ${meta.label} connection. Try again, or use Settings → Connections.`,
      );
    } finally {
      setBusy(false);
    }
  }

  if (connected || finalizing) {
    return (
      <div className="gcard" style={{ padding: 18, maxWidth: 420 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <ConnectGlyph service={service} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15.5, fontWeight: 700 }}>{meta.label}</div>
            <div style={{ fontSize: 12.5, color: "var(--cf-grad-end)" }}>
              {connected
                ? "Connected — Indyfren can act on it now"
                : "Connection successful — finalizing…"}
            </div>
          </div>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              fontWeight: 700,
              color: "var(--cf-grad-end)",
            }}
          >
            {Icon.check({ size: 16, color: "var(--cf-grad-end)" })}
            {connected ? "Linked" : "Success"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="gcard" style={{ padding: 18, maxWidth: 420 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 10,
        }}
      >
        <ConnectGlyph service={service} />
        <div>
          <div style={{ fontSize: 15.5, fontWeight: 700 }}>
            Connect {meta.label}
          </div>
          <div style={{ fontSize: 12, color: "rgb(var(--ink) / 0.5)" }}>
            You&apos;re in control — Indyfren only gets the permissions you
            grant.
          </div>
        </div>
      </div>

      {link ? (
        <div
          style={{
            background: "rgb(var(--ink) / 0.04)",
            border: "1px solid rgb(var(--ink) / 0.08)",
            borderRadius: 12,
            padding: 12,
          }}
        >
          <div
            style={{
              fontSize: 12.5,
              color: "rgb(var(--ink) / 0.6)",
              marginBottom: 6,
            }}
          >
            Send this to the Indyfren {meta.label} bot:
          </div>
          <code
            style={{
              display: "block",
              fontFamily: "var(--font-mono)",
              fontSize: 12.5,
              background: "rgb(var(--ink) / 0.06)",
              borderRadius: 8,
              padding: "8px 12px",
            }}
          >
            {link.command}
          </code>
          {link.launchUrl && (
            <a
              href={link.launchUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-block",
                marginTop: 10,
                fontSize: 12.5,
                fontWeight: 700,
                color: "var(--cf-accent-blue)",
              }}
            >
              Open {meta.label} →
            </a>
          )}
        </div>
      ) : (
        <button
          className="btn-primary"
          style={{ height: 46 }}
          disabled={busy}
          onClick={() => void go()}
        >
          {busy ? "Starting…" : `Continue to ${meta.label}`}
        </button>
      )}
      {err && (
        <p style={{ fontSize: 12, color: "var(--cf-coral)", marginTop: 8 }}>
          {err}{" "}
          <button
            onClick={onOpenSettings}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              fontSize: 12,
              fontWeight: 700,
              color: "var(--cf-accent-blue)",
              cursor: "pointer",
            }}
          >
            Open Settings →
          </button>
        </p>
      )}
    </div>
  );
}

function ConnectCards({
  services,
  accessToken,
  accounts,
  recentSuccessToolkit,
  onOpenSettings,
}: {
  services: string[];
  accessToken: string | null;
  accounts: ConnectionAccountLike[];
  recentSuccessToolkit: string | null;
  onOpenSettings: () => void;
}) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {services.map((service) => (
        <ConnectCard
          key={service}
          service={service}
          accessToken={accessToken}
          accounts={accounts}
          recentSuccessToolkit={recentSuccessToolkit}
          onOpenSettings={onOpenSettings}
        />
      ))}
    </div>
  );
}

const ACTION_CARDS = [
  {
    key: "deals",
    title: "Find brand deals",
    body: "Ask Indyfren to scan the brand landscape for sponsors that fit your niche.",
    cta: "Scan for deals",
    prompt: "Scan for brand deals that fit me",
  },
  {
    key: "rate",
    title: "Know your rate",
    body: "Get a data-backed rate for a sponsored post — what to charge, and why.",
    cta: "What should I charge?",
    prompt: "What should I charge for a sponsored post?",
  },
  {
    key: "connect",
    title: "Connect your world",
    body: "Link your platforms so Indyfren can build accurate rates and reports.",
    cta: "Open connections",
    connect: true,
  },
];

const LIBRARY = [
  {
    name: "Rate Card",
    sub: "What to charge, by platform",
    pose: "mark",
    color: "var(--cf-cyan)",
    prompt: "Show me my rate card — what should I charge per platform?",
  },
  {
    name: "Deal Tracker",
    sub: "Your live pipeline",
    pose: "handshake",
    color: "var(--cf-mint)",
    nav: "/dashboard/deals",
  },
  {
    name: "Media Kit",
    sub: "Pitch-ready one-pager",
    pose: "reach",
    color: "var(--cf-periwinkle)",
    prompt: "Help me put together a media kit for brand pitches",
  },
  {
    name: "Content Plan",
    sub: "This week's ideas",
    pose: "squad",
    color: "var(--cf-lavender, #A6E1FA)",
    prompt: "Give me a content plan for this week",
  },
];

function AskBar({
  value,
  setValue,
  onSend,
  disabled,
}: {
  value: string;
  setValue: (v: string) => void;
  onSend: (t: string) => void;
  disabled: boolean;
}) {
  const [menu, setMenu] = useState(false);
  const router = useRouter();
  const { openSettings } = useShell();
  const quick = ["Plan my day", "Check my deals", "What should I charge?"];
  return (
    <div style={{ position: "relative", width: "min(680px, 100%)" }}>
      {menu && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 45 }}
            onClick={() => setMenu(false)}
          />
          <div
            className="pop fade"
            style={{
              position: "absolute",
              bottom: 66,
              left: 0,
              width: 280,
              padding: 8,
              zIndex: 46,
            }}
          >
            <div className="pop-label">Quick actions</div>
            {quick.map((q) => (
              <button
                key={q}
                className="pop-item"
                onClick={() => {
                  setMenu(false);
                  onSend(q);
                }}
              >
                {Icon.spark({ size: 18, color: "var(--cf-accent-blue)" })} {q}
              </button>
            ))}
            <div className="pop-sep" />
            <button
              className="pop-item"
              onClick={() => {
                setMenu(false);
                router.push("/dashboard/deals");
              }}
            >
              {Icon.briefcase({ size: 18, color: "rgb(var(--ink) / 0.7)" })}{" "}
              Open deal pipeline
            </button>
            <button
              className="pop-item"
              onClick={() => {
                setMenu(false);
                openSettings("connections");
              }}
            >
              {Icon.link2({ size: 18, color: "rgb(var(--ink) / 0.7)" })}{" "}
              Connections
            </button>
          </div>
        </>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSend(value);
        }}
        className="ask-bar"
      >
        <button
          type="button"
          className="ask-add"
          data-active={menu}
          onClick={() => setMenu((m) => !m)}
          style={{
            transform: menu ? "rotate(45deg)" : "none",
            transition: "transform 0.25s var(--ease-out-expo)",
          }}
        >
          {Icon.plus({ size: 18 })}
        </button>
        <textarea
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend(value);
            }
          }}
          placeholder="Ask Indyfren anything…"
        />
        <button
          type="submit"
          className="ask-send"
          disabled={disabled || !value.trim()}
        >
          {Icon.up({ size: 18 })}
        </button>
      </form>
    </div>
  );
}

const CACHE_KEY = "indyfren_agent_cf_v1";
const FEED_STALE_MS = 30_000;

interface FeedCache {
  feed: FeedItem[];
  savedAt: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCachedApproval(value: unknown): value is DashboardPendingApproval {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.actionId === "string" &&
    typeof value.type === "string" &&
    typeof value.description === "string"
  );
}

function isFeedItem(value: unknown): value is FeedItem {
  if (!isRecord(value) || typeof value.id !== "string") {
    return false;
  }

  switch (value.kind) {
    case "user":
    case "agent":
      return typeof value.text === "string";
    case "working":
      return (
        typeof value.skill === "string" &&
        Array.isArray(value.steps) &&
        value.steps.every((step) => typeof step === "string") &&
        typeof value.stepIdx === "number"
      );
    case "approval":
      return (
        isCachedApproval(value.approval) &&
        (value.state === "pending" ||
          value.state === "approved" ||
          value.state === "skipped") &&
        (value.result === undefined || typeof value.result === "string")
      );
    case "connect":
      return (
        Array.isArray(value.services) &&
        value.services.every((service) => typeof service === "string")
      );
    default:
      return false;
  }
}

function isFeedCache(value: unknown): value is FeedCache {
  return (
    isRecord(value) &&
    Array.isArray(value.feed) &&
    value.feed.every(isFeedItem) &&
    typeof value.savedAt === "number" &&
    Number.isFinite(value.savedAt)
  );
}

// Chat feed cache is namespaced per creator so one user's conversation can never
// be shown to another after an account switch.
function feedCacheKey(creatorId: string): string {
  return `${CACHE_KEY}:${creatorId}`;
}

function readFeedCache(key: string): FeedCache | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every(isFeedItem)) {
      return { feed: parsed, savedAt: 0 };
    }
    return isFeedCache(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeFeedCache(key: string, feed: FeedItem[]) {
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({
        feed: feed.filter((item) => item.kind !== "working"),
        savedAt: Date.now(),
      }),
    );
  } catch {}
}

export function AgentHome({ initialQuery }: { initialQuery?: string }) {
  const { accessToken, creator, stage } = useAuth();
  const router = useRouter();
  const { openSettings, libraryOpen, setLibrary } = useShell();
  const name = creator?.display_name ?? "there";
  const feedKey = creator?.id ? feedCacheKey(creator.id) : null;
  const feedKeyRef = useRef(feedKey);
  feedKeyRef.current = feedKey;
  const cachedFeed = useRef<FeedCache | null>(null);

  const [feed, setFeed] = useState<FeedItem[]>(() => {
    cachedFeed.current = feedKey ? readFeedCache(feedKey) : null;
    if (cachedFeed.current) return cachedFeed.current.feed;
    return [];
  });
  const [started, setStarted] = useState(feed.length > 0);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [approvalBusy, setApprovalBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const firedInitial = useRef(false);

  // Live connection state for the connect cards in the feed (shared cache key
  // with Settings → both views always agree on what's connected).
  const { data: connectionsInfo, refresh: refreshConnections } = useAuthedQuery(
    fetchConnectionsInfo,
    EMPTY_CONNECTIONS,
    "indyfren_connections_v1",
  );
  const [recentSuccessToolkit, setRecentSuccessToolkit] = useState<
    string | null
  >(null);
  useEffect(() => {
    setRecentSuccessToolkit(readRecentConnectionSuccess());
  }, []);

  // Right after OAuth a connection can be INITIALIZING for a few seconds.
  // Poll until the API confirms it, then retire the transient success hint.
  useEffect(() => {
    if (!recentSuccessToolkit) return;
    const confirmed = connectionsInfo.accounts.some(
      (account) =>
        account.toolkit.toLowerCase() === recentSuccessToolkit &&
        account.connected,
    );
    if (confirmed) {
      clearRecentConnectionSuccess(recentSuccessToolkit);
      setRecentSuccessToolkit(null);
      return;
    }
    const timer = setTimeout(() => void refreshConnections(), 3000);
    return () => clearTimeout(timer);
  }, [recentSuccessToolkit, connectionsInfo.accounts, refreshConnections]);

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [feed]);

  const load = useCallback(async () => {
    if (!accessToken || !canAccessCreatorData(stage)) return;
    if (
      cachedFeed.current &&
      Date.now() - cachedFeed.current.savedAt < FEED_STALE_MS
    ) {
      return;
    }

    try {
      const state = await fetchAgentState(accessToken);
      const built = buildFeed(state);
      if (built.length > 0) {
        setFeed(built);
        setStarted(true);
        if (feedKeyRef.current) writeFeedCache(feedKeyRef.current, built);
        cachedFeed.current = { feed: built, savedAt: Date.now() };
      }
    } catch {}
  }, [accessToken, stage]);
  useEffect(() => {
    void load();
  }, [load]);

  const persist = useCallback((next: FeedItem[]) => {
    if (feedKeyRef.current) writeFeedCache(feedKeyRef.current, next);
    cachedFeed.current = {
      feed: next.filter((item) => item.kind !== "working"),
      savedAt: Date.now(),
    };
  }, []);

  const send = useCallback(
    async (text: string) => {
      const t = text.trim();
      if (!t || !accessToken || busy) return;
      setInput("");
      setStarted(true);
      setError(null);
      setBusy(true);
      setLibrary(false);
      const base = Date.now();
      const userItem: FeedItem = { kind: "user", id: `u-${base}`, text: t };
      const workingItem: FeedItem = {
        kind: "working",
        id: `w-${base}`,
        skill: "Indyfren",
        steps: WORKING_STEPS,
        stepIdx: 0,
      };
      setFeed((f) => [
        ...f.filter((x) => x.kind !== "working"),
        userItem,
        workingItem,
      ]);
      WORKING_STEPS.forEach((_, i) =>
        setTimeout(
          () =>
            setFeed((f) =>
              f.map((x) =>
                x.id === workingItem.id && x.kind === "working"
                  ? { ...x, stepIdx: i + 1 }
                  : x,
              ),
            ),
          650 * (i + 1),
        ),
      );
      try {
        const res = await sendAgentMessage(accessToken, t);
        const built = buildFeed({
          messages: res.messages,
          pendingApprovals: res.pendingApprovals,
        });
        setFeed(built);
        persist(built);
        broadcastDealsChanged();
      } catch (e) {
        setFeed((f) => f.filter((x) => x.id !== workingItem.id));
        setError(
          e instanceof Error
            ? e.message
            : "Couldn't reach Indyfren. Try again.",
        );
        setInput(t);
      } finally {
        setBusy(false);
      }
    },
    [accessToken, busy, persist, setLibrary],
  );

  useEffect(() => {
    if (firedInitial.current) return;
    if (initialQuery && initialQuery.trim() && accessToken) {
      firedInitial.current = true;
      void send(initialQuery);
    }
  }, [initialQuery, accessToken, send]);

  const handleApprove = useCallback(
    async (id: string, approval: DashboardPendingApproval) => {
      if (!accessToken) return;
      setApprovalBusy(id);
      try {
        const res = await approveAgentAction(accessToken, approval.actionId);
        const result =
          res.execution?.costCents != null
            ? `${res.execution.message} ($${(res.execution.costCents / 100).toFixed(2)})`
            : (res.execution?.message ?? "Done — Indyfren ran it.");
        setFeed((f) =>
          f.map((x) =>
            x.id === id && x.kind === "approval"
              ? { ...x, state: "approved", result }
              : x,
          ),
        );
        broadcastDealsChanged();
        void load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't approve that.");
      } finally {
        setApprovalBusy(null);
      }
    },
    [accessToken, load],
  );

  const handleSkip = useCallback(
    async (id: string, approval: DashboardPendingApproval) => {
      if (!accessToken) return;
      setApprovalBusy(id);
      try {
        await skipAgentAction(accessToken, approval.actionId);
        setFeed((f) =>
          f.map((x) =>
            x.id === id && x.kind === "approval"
              ? { ...x, state: "skipped" }
              : x,
          ),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't skip that.");
      } finally {
        setApprovalBusy(null);
      }
    },
    [accessToken],
  );

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", zIndex: 1 }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          width: "200%",
          transform: libraryOpen ? "translateX(-50%)" : "translateX(0)",
          transition: "transform 0.6s var(--ease-out-expo)",
        }}
      >
        {/* PANEL 1 — console */}
        <div style={{ width: "50%", height: "100%", position: "relative" }}>
          <div
            ref={scrollRef}
            className="scroll-y"
            style={{
              position: "absolute",
              inset: 0,
              padding: "100px 20px 150px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: started ? "flex-start" : "center",
            }}
          >
            <div
              style={{
                width: "min(680px, 100%)",
                margin: started ? "auto 0" : "0 auto",
                paddingBottom: 8,
              }}
            >
              {!started ? (
                <div className="fade">
                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "flex-start",
                      marginBottom: 22,
                    }}
                  >
                    <Avatar />
                    <div className="bubble-agent" style={{ flex: 1 }}>
                      <p style={{ margin: "0 0 12px" }}>hey {name} 👋</p>
                      <p style={{ margin: 0 }}>
                        welcome — i&apos;m indyfren, your AI business manager. i
                        scout brand deals, draft your pitches, and track every
                        dollar — while you create. where should we start?
                      </p>
                    </div>
                  </div>
                  <div
                    className="scroll-x"
                    style={{
                      display: "grid",
                      gridAutoFlow: "column",
                      gridAutoColumns: "minmax(216px, 1fr)",
                      gap: 12,
                      padding: "2px 2px 8px",
                    }}
                  >
                    {ACTION_CARDS.map((c) => (
                      <div
                        key={c.key}
                        className="gcard rise"
                        style={{
                          padding: 18,
                          display: "flex",
                          flexDirection: "column",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 16,
                            fontWeight: 700,
                            letterSpacing: "-0.01em",
                            marginBottom: 6,
                          }}
                        >
                          {c.title}
                        </div>
                        <p
                          style={{
                            fontSize: 13,
                            lineHeight: 1.5,
                            color: "rgb(var(--ink) / 0.55)",
                            margin: 0,
                          }}
                        >
                          {c.body}
                        </p>
                        <div style={{ flex: 1, minHeight: 18 }} />
                        <button
                          className="dark-pill"
                          style={{ height: 40, width: "100%" }}
                          onClick={() =>
                            c.connect
                              ? openSettings("connections")
                              : send(c.prompt!)
                          }
                        >
                          {c.cta}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 18 }}
                >
                  {feed.map((m) => {
                    if (m.kind === "user")
                      return (
                        <div key={m.id} className="bubble-user rise">
                          {m.text}
                        </div>
                      );
                    if (m.kind === "working") return <WorkingView key={m.id} />;
                    if (m.kind === "agent")
                      return (
                        <div
                          key={m.id}
                          className="rise"
                          style={{
                            display: "flex",
                            gap: 12,
                            alignItems: "flex-start",
                          }}
                        >
                          <Avatar />
                          <div
                            className="bubble-agent"
                            style={{ flex: 1, whiteSpace: "pre-wrap" }}
                          >
                            {mdBold(m.text)}
                          </div>
                        </div>
                      );
                    if (m.kind === "approval")
                      return (
                        <div
                          key={m.id}
                          className="rise"
                          style={{ marginLeft: 46 }}
                        >
                          <DecisionCard
                            approval={m.approval}
                            state={m.state}
                            result={m.result}
                            busy={approvalBusy === m.id}
                            onApprove={() => handleApprove(m.id, m.approval)}
                            onSkip={() => handleSkip(m.id, m.approval)}
                          />
                        </div>
                      );
                    if (m.kind === "connect")
                      return (
                        <div
                          key={m.id}
                          className="rise"
                          style={{ marginLeft: 46 }}
                        >
                          <ConnectCards
                            services={m.services}
                            accessToken={accessToken}
                            accounts={connectionsInfo.accounts}
                            recentSuccessToolkit={recentSuccessToolkit}
                            onOpenSettings={() => openSettings("connections")}
                          />
                        </div>
                      );
                    return null;
                  })}
                  {error && (
                    <div
                      style={{
                        marginLeft: 46,
                        fontSize: 13,
                        color: "var(--cf-coral)",
                        background: "rgba(255,107,107,0.1)",
                        border: "1px solid rgba(255,107,107,0.28)",
                        borderRadius: 14,
                        padding: "10px 14px",
                      }}
                    >
                      {error}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: "calc(20px + env(safe-area-inset-bottom))",
              display: "grid",
              placeItems: "center",
              padding: "0 20px",
            }}
          >
            <AskBar
              value={input}
              setValue={setInput}
              onSend={send}
              disabled={busy}
            />
          </div>
        </div>

        {/* PANEL 2 — app library */}
        <div style={{ width: "50%", height: "100%", position: "relative" }}>
          <div
            className="scroll-y"
            style={{
              position: "absolute",
              inset: 0,
              padding: "104px 28px 64px",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <div style={{ width: "min(880px, 100%)" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                  gap: 16,
                  marginBottom: 24,
                }}
              >
                <div>
                  <div className="eyebrow" style={{ marginBottom: 8 }}>
                    App library
                  </div>
                  <h1
                    className="h-title"
                    style={{ fontSize: 27, marginBottom: 6 }}
                  >
                    Apps Indyfren runs for you
                  </h1>
                  <p className="h-sub">
                    Tap one to put it to work — your agent does the rest.
                  </p>
                </div>
                <button
                  className="dark-pill"
                  onClick={() =>
                    send("What apps can you build and run for me?")
                  }
                >
                  {Icon.plus({ size: 17 })} Create app
                </button>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: 14,
                }}
              >
                {LIBRARY.map((a, i) => (
                  <button
                    key={a.name}
                    className="gcard rise lib-card"
                    style={{
                      animationDelay: `${i * 0.06}s`,
                      padding: 18,
                      height: 172,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      cursor: "pointer",
                      textAlign: "left",
                      border: "1px solid rgb(var(--ink) / 0.09)",
                    }}
                    onClick={() =>
                      a.nav
                        ? (setLibrary(false), router.push(a.nav))
                        : a.prompt
                          ? send(a.prompt)
                          : undefined
                    }
                  >
                    <FrenBadge
                      pose={a.pose}
                      size={48}
                      radius={14}
                      bg={a.color}
                      color="var(--cf-dark-blue)"
                      inset={0.62}
                    />
                    <div>
                      <div
                        style={{
                          fontSize: 16,
                          fontWeight: 600,
                          marginBottom: 3,
                        }}
                      >
                        {a.name}
                      </div>
                      <div
                        style={{
                          fontSize: 12.5,
                          color: "rgb(var(--ink) / 0.45)",
                        }}
                      >
                        {a.sub}
                      </div>
                    </div>
                  </button>
                ))}
                <button
                  className="lib-card"
                  onClick={() => openSettings("connections")}
                  style={{
                    height: 172,
                    borderRadius: 24,
                    border: "1.5px dashed rgb(var(--ink) / 0.18)",
                    background: "transparent",
                    color: "rgb(var(--ink) / 0.55)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 12,
                  }}
                >
                  <span
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 99,
                      border: "1.5px solid currentColor",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    {Icon.plus({ size: 20 })}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>
                    Connect a tool
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
