"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

import {
  approveAgentAction,
  fetchAgentState,
  sendAgentMessage,
  skipAgentAction,
  type DashboardAgentState,
} from "../lib/api";
import { canAccessCreatorData } from "../lib/auth-state";
import { formatDashboardDateTime } from "../lib/datetime";
import { broadcastDealsChanged } from "../lib/deals-sync";
import { useAuth } from "../lib/privy";

const EMPTY_AGENT_STATE: DashboardAgentState = {
  messages: [],
  pendingApprovals: [],
};

const AGENT_CACHE_KEY = "indyfren_agent_v1";

function writeAgentCache(state: DashboardAgentState) {
  try {
    sessionStorage.setItem(AGENT_CACHE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota/access errors
  }
}

const QUICK_PROMPTS = [
  "Plan my day",
  "Check my deals",
  "Show wallet activity",
  "Draft a sponsor reply",
];

export function AgentConsole({
  initialState,
  isHydrated = false,
  onDealsChanged,
  initialQuery,
}: {
  initialState?: DashboardAgentState;
  isHydrated?: boolean;
  onDealsChanged?: () => void;
  initialQuery?: string;
}) {
  const { accessToken, creator, onboarding, stage } = useAuth();
  // Keep a ref so the effect can read the latest initialState without it being a dep.
  // This prevents parent re-renders (which may recreate initialState with the same
  // data but a new object reference) from triggering a re-fetch.
  const initialStateRef = useRef(initialState);
  initialStateRef.current = initialState;

  const [data, setData] = useState<DashboardAgentState>(() => {
    if (initialState) return initialState;
    // Serve cached agent state immediately so conversation appears without a loading flash
    try {
      const raw = sessionStorage.getItem(AGENT_CACHE_KEY);
      if (raw) return JSON.parse(raw) as DashboardAgentState;
    } catch { /* ignore */ }
    return EMPTY_AGENT_STATE;
  });
  const [error, setError] = useState<string | null>(null);
  // Only show loading shell if we have neither server-provided state nor a cache hit
  const [isLoading, setIsLoading] = useState(() => {
    if (isHydrated || initialState) return false;
    try {
      return !sessionStorage.getItem(AGENT_CACHE_KEY);
    } catch {
      return true;
    }
  });
  const [draft, setDraft] = useState(initialQuery ?? "");
  const [working, setWorking] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === "function") {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [data.messages.length, scrollToBottom]);

  const load = useCallback(
    async (token: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const next = await fetchAgentState(token);
        setData(next);
        writeAgentCache(next);
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : "Unable to load dashboard data"
        );
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!canAccessCreatorData(stage) || !accessToken) {
      setIsLoading(false);
      setError(null);
      setData(EMPTY_AGENT_STATE);
      return;
    }

    if (isHydrated) {
      // Use ref to read latest initialState without making it a dep.
      // Avoids re-running when parent re-renders with the same data but new object ref.
      const next = initialStateRef.current ?? EMPTY_AGENT_STATE;
      setData(next);
      writeAgentCache(next);
      setError(null);
      setIsLoading(false);
      return;
    }

    void load(accessToken);
  }, [accessToken, isHydrated, load, stage]); // initialState intentionally omitted — use ref

  const refresh = useCallback(async () => {
    if (!accessToken || !canAccessCreatorData(stage)) {
      return;
    }

    await load(accessToken);
  }, [accessToken, load, stage]);

  async function handleSend(nextText?: string) {
    const text = (nextText ?? draft).trim();
    if (!accessToken || !text) {
      setActionError("Write a message before sending it to the agent.");
      return;
    }

    setWorking(true);
    setActionError(null);
    setActionMessage(null);
    setDraft("");

    // Optimistically append the user message so it appears instantly
    const optimisticId = `optimistic-${Date.now()}`;
    setData((current) => ({
      ...current,
      messages: [
        ...current.messages,
        {
          id: optimisticId,
          creator_id: creator?.id ?? "",
          role: "user",
          content: text,
          metadata: null,
          created_at: new Date().toISOString(),
        },
      ],
    }));

    try {
      const response = await sendAgentMessage(accessToken, text);
      const nextState = { messages: response.messages, pendingApprovals: response.pendingApprovals };
      setData(nextState);
      writeAgentCache(nextState);
      // draft already cleared above
      setActionMessage(
        response.reply.requiresApproval
          ? "Indyfren drafted an action that needs your approval."
          : "Indyfren replied."
      );
      // Broadcast so the deals page refreshes immediately, same-tab and cross-tab
      broadcastDealsChanged();
      onDealsChanged?.();
    } catch (sendError) {
      // Roll back the optimistic message on failure
      setData((current) => ({
        ...current,
        messages: current.messages.filter((m) => m.id !== optimisticId),
      }));
      setDraft(text); // restore draft so user doesn't lose their message
      setActionError(
        sendError instanceof Error
          ? sendError.message
          : "Unable to send your message right now."
      );
    } finally {
      setWorking(false);
    }
  }

  async function handleApprove(actionId: string) {
    if (!accessToken) {
      return;
    }

    setWorking(true);
    setActionError(null);
    setActionMessage(null);

    try {
      const response = await approveAgentAction(accessToken, actionId);
      setData((current) => ({
        ...current,
        pendingApprovals: response.pendingApprovals,
      }));
      setActionMessage(
        response.execution?.costCents
          ? `${response.execution.message} ($${(response.execution.costCents / 100).toFixed(2)})`
          : response.execution?.message ?? "Approved and executed."
      );
      broadcastDealsChanged();
      onDealsChanged?.();
      await refresh();
    } catch (approveError) {
      setActionError(
        approveError instanceof Error
          ? approveError.message
          : "Unable to approve that action."
      );
    } finally {
      setWorking(false);
    }
  }

  async function handleSkip(actionId: string) {
    if (!accessToken) {
      return;
    }

    setWorking(true);
    setActionError(null);
    setActionMessage(null);

    try {
      const response = await skipAgentAction(accessToken, actionId);
      setData((current) => ({
        ...current,
        pendingApprovals: response.pendingApprovals,
      }));
      setActionMessage("Action skipped.");
    } catch (skipError) {
      setActionError(
        skipError instanceof Error ? skipError.message : "Unable to skip that action."
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <article
      className="flex flex-col overflow-hidden"
      style={{
        background: 'var(--bg-surface)',
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--border-default)',
      }}
    >
      {/* Header */}
      <div className="border-b border-border-default px-6 pt-6 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3
              className="text-[15px] font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              Chat with Indyfren
            </h3>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
              Ask for help with deals, pitches, approvals, payouts, or planning
              your next move.
            </p>
          </div>
          {creator?.display_name ? (
            <p
              className="px-3 py-1.5 text-xs font-medium"
              style={{
                color: 'var(--text-tertiary)',
                background: 'var(--bg-input)',
                borderRadius: 'var(--radius-chip)',
                border: '1px solid var(--border-default)',
              }}
            >
              {creator.display_name}
            </p>
          ) : null}
        </div>

        {!onboarding.walletProvisioned ? (
          <div
            className="mt-3 px-4 py-3 text-xs leading-6"
            style={{
              border: '1px solid var(--border-default)',
              background: 'var(--bg-input)',
              color: 'var(--text-tertiary)',
              borderRadius: 'var(--radius-input)',
            }}
          >
            Your wallet is still being set up. You can chat, review drafts, and
            manage approvals while that finishes in the background.
          </div>
        ) : null}

        {/* Quick prompts */}
        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((prompt, index) => (
            <button
              key={prompt}
              onClick={() => {
                void handleSend(prompt);
              }}
              disabled={working}
              className="disabled:opacity-50"
              style={{
                border: index % 2 === 0
                  ? '1.5px solid var(--accent-pink-border-strong)'
                  : '1.5px solid var(--accent-blue-border-strong)',
                color: index % 2 === 0
                  ? 'var(--accent-pink)'
                  : 'var(--accent-blue)',
                background: 'var(--bg-canvas)',
                borderRadius: 'var(--radius-chip)',
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Message area */}
      <div className="min-h-[420px] max-h-[460px] flex-1 space-y-3 overflow-y-auto px-6 py-4">
        {data.messages.map((message) => {
          const platform =
            message.metadata && typeof message.metadata.platform === "string"
              ? message.metadata.platform
              : null;
          const isAssistant = message.role === "assistant";

          return (
            <div
              key={message.id}
              className={`px-4 py-3 ${isAssistant ? "" : "ml-8"}`}
              style={{
                border: '1px solid var(--border-default)',
                background: isAssistant ? 'var(--bg-canvas)' : 'var(--bg-input)',
                borderRadius: 'var(--radius-input)',
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p
                  className="text-xs font-semibold"
                  style={{
                    fontSize: 11,
                    color: 'var(--text-tertiary)',
                  }}
                >
                  {isAssistant ? "Indyfren" : "You"}
                  {platform ? ` · ${platform}` : ""}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {formatDashboardDateTime(message.created_at)}
                </p>
              </div>
              <p
                className="mt-2 whitespace-pre-wrap text-sm leading-7"
                style={{ color: 'var(--text-primary)' }}
              >
                {message.content}
              </p>
            </div>
          );
        })}

        {data.messages.length === 0 ? (
          <div
            className="flex h-full items-center justify-center p-8 text-center text-sm leading-7"
            style={{
              border: '1px dashed var(--border-default)',
              color: 'var(--text-tertiary)',
              borderRadius: 'var(--radius-card)',
            }}
          >
            {isLoading
              ? "Loading your conversation..."
              : "No conversation yet. Ask Indyfren to scan for deals, summarize the day, or draft a sponsor pitch."}
          </div>
        ) : null}

        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-border-default px-6 py-4">
        <form
          className="flex gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSend();
          }}
        >
          <textarea
            id="agent-console-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSend();
              }
            }}
            placeholder="Ask Indyfren to review a deal, draft a reply, explain your numbers, or plan your day..."
            rows={2}
            className="flex-1 resize-none px-4 py-3 text-sm outline-none transition focus:border-[var(--border-focus)]"
            style={{
              border: '1.5px solid var(--border-light)',
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              borderRadius: 'var(--radius-input)',
            }}
          />
          <div className="flex flex-col gap-2">
            <button
              type="submit"
              disabled={working}
              className="disabled:opacity-50"
              style={{
                background: 'var(--accent-blue)',
                color: 'white',
                borderRadius: 'var(--radius-button)',
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {working ? "Working..." : "Ask Indyfren"}
            </button>
            <button
              type="button"
              onClick={() => {
                void refresh();
              }}
              disabled={working}
              className="disabled:opacity-50"
              style={{
                border: '1.5px solid var(--border-light)',
                borderRadius: 'var(--radius-button)',
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--text-primary)',
              }}
            >
              Refresh
            </button>
          </div>
        </form>

        {error || actionError ? (
          <p
            className="mt-3 px-4 py-3 text-sm"
            style={{
              border: '1px solid var(--accent-pink-border)',
              background: 'var(--accent-pink-subtle)',
              color: 'var(--text-primary)',
              borderRadius: 'var(--radius-input)',
            }}
          >
            {actionError ?? error}
          </p>
        ) : null}
        {actionMessage ? (
          <p
            className="mt-3 px-4 py-3 text-sm"
            style={{
              border: '1px solid var(--border-default)',
              background: 'var(--bg-canvas)',
              color: 'var(--text-primary)',
              borderRadius: 'var(--radius-input)',
            }}
          >
            {actionMessage}
          </p>
        ) : null}
      </div>

      {/* Pending approvals */}
      {data.pendingApprovals.length > 0 ? (
        <div
          className="px-6 py-5"
          style={{
            background: 'var(--gradient-approval)',
            borderTop: '1px solid var(--border-default)',
            color: 'white',
          }}
        >
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
            Actions waiting on you
          </p>
          <div className="mt-4 space-y-3">
            {data.pendingApprovals.map((approval) => (
              <div
                key={approval.id}
                className="p-4"
                style={{
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: 'var(--radius-input)',
                }}
              >
                <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  {approval.type}
                </p>
                <p className="mt-2 text-base font-semibold">
                  {approval.description}
                </p>
                <p className="mt-2 text-sm leading-7" style={{ color: 'rgba(255,255,255,0.72)' }}>
                  {approval.preview}
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={() => {
                      void handleApprove(approval.actionId);
                    }}
                    disabled={working}
                    className="transition hover:opacity-90 disabled:opacity-50"
                    style={{
                      background: 'var(--accent-green)',
                      color: 'white',
                      borderRadius: 'var(--radius-chip)',
                      padding: '6px 14px',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      void handleSkip(approval.actionId);
                    }}
                    disabled={working}
                    className="transition hover:opacity-90 disabled:opacity-50"
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      color: 'white',
                      borderRadius: 'var(--radius-chip)',
                      padding: '6px 14px',
                      fontSize: 12,
                    }}
                  >
                    Skip
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}
