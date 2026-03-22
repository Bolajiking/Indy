"use client";

import { useCallback, useEffect, useState } from "react";

import {
  approveAgentAction,
  fetchAgentState,
  sendAgentMessage,
  skipAgentAction,
  type DashboardAgentState,
} from "@/lib/api";
import { canAccessCreatorData } from "@/lib/auth-state";
import { formatDashboardDateTime } from "@/lib/datetime";
import { useAuth } from "@/lib/privy";

const EMPTY_AGENT_STATE: DashboardAgentState = {
  messages: [],
  pendingApprovals: [],
};

const QUICK_PROMPTS = [
  "scan for brand deals",
  "show my wallet balance",
  "give me my morning brief",
  "draft a pitch for a fintech sponsor",
];

export function AgentConsole({
  initialState,
  isHydrated = false,
}: {
  initialState?: DashboardAgentState;
  isHydrated?: boolean;
}) {
  const { accessToken, creator, onboarding, stage } = useAuth();
  const [data, setData] = useState<DashboardAgentState>(
    initialState ?? EMPTY_AGENT_STATE
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!isHydrated);
  const [draft, setDraft] = useState("");
  const [working, setWorking] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(
    async (token: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const next = await fetchAgentState(token);
        setData(next);
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : "Unable to load dashboard data"
        );
        setData(initialState ?? EMPTY_AGENT_STATE);
      } finally {
        setIsLoading(false);
      }
    },
    [initialState]
  );

  useEffect(() => {
    if (isHydrated) {
      setData(initialState ?? EMPTY_AGENT_STATE);
      setError(null);
      setIsLoading(false);
      return;
    }

    if (initialState !== undefined) {
      setData(initialState);
      setError(null);
      setIsLoading(true);
      return;
    }

    if (!canAccessCreatorData(stage) || !accessToken) {
      setIsLoading(false);
      setError(null);
      setData(EMPTY_AGENT_STATE);
      return;
    }

    void load(accessToken);
  }, [accessToken, initialState, isHydrated, load, stage]);

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

    try {
      const response = await sendAgentMessage(accessToken, text);
      setData({
        messages: response.messages,
        pendingApprovals: response.pendingApprovals,
      });
      setDraft("");
      setActionMessage(
        response.reply.requiresApproval
          ? "The agent drafted an action that needs your approval. Review it below."
          : "The agent replied."
      );
    } catch (sendError) {
      setActionError(
        sendError instanceof Error
          ? sendError.message
          : "Unable to send your message to the agent."
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
          : response.execution?.message ?? "Approved action executed."
      );
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
      setActionMessage("The pending action was skipped.");
    } catch (skipError) {
      setActionError(
        skipError instanceof Error ? skipError.message : "Unable to skip that action."
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <article className="paper-panel rounded-card border border-black/10 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow text-[11px] text-fog">Agent console</p>
            <h3 className="display-title mt-2 text-3xl text-ink">
              Chat with the same agent that answers in Telegram.
            </h3>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-fog">
              Every dashboard message writes into the same creator history, so your agent
              can pick up where Telegram, WhatsApp, or the dashboard left off.
            </p>
          </div>
          <p className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-ink">
            {creator?.display_name ?? "Creator"} console
          </p>
        </div>

        {!onboarding.walletProvisioned ? (
          <div className="mt-5 rounded-[22px] border border-black/10 bg-parchment p-4 text-sm leading-7 text-fog">
            Wallet-backed actions may still pause until provisioning and funding catch up,
            but you can already brief the agent, review drafts, and manage pending actions
            from here.
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => {
                void handleSend(prompt);
              }}
              disabled={working}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-ink transition hover:bg-parchment disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>

        <div className="mt-6 max-h-[520px] space-y-3 overflow-y-auto pr-1">
          {data.messages.map((message) => {
            const platform =
              message.metadata && typeof message.metadata.platform === "string"
                ? message.metadata.platform
                : null;
            const isAssistant = message.role === "assistant";

            return (
              <div
                key={message.id}
                className={`rounded-[22px] border p-4 ${
                  isAssistant
                    ? "border-black/10 bg-white/85"
                    : "border-black/10 bg-parchment"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fog">
                    {isAssistant ? "Agent" : "You"}
                    {platform ? ` • ${platform}` : ""}
                  </p>
                  <p className="text-xs text-fog">
                    {formatDashboardDateTime(message.created_at)}
                  </p>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-ink">
                  {message.content}
                </p>
              </div>
            );
          })}

          {data.messages.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-black/10 p-5 text-sm leading-7 text-fog">
              {isLoading
                ? "Loading the shared creator conversation..."
                : "No conversation yet. Ask the agent to scan for deals, summarize the day, or draft a sponsor pitch."}
            </div>
          ) : null}
        </div>

        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSend();
          }}
        >
          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-fog">
              Message the agent
            </span>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask for a morning brief, scan for deals, or draft a sponsor pitch..."
              rows={4}
              className="w-full rounded-[22px] border border-black/10 bg-parchment px-4 py-4 text-sm text-ink outline-none transition focus:border-plum"
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={working}
              className="rounded-full bg-ink px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-paper transition hover:bg-plum disabled:opacity-50"
            >
              {working ? "Working..." : "Send to agent"}
            </button>
            <button
              type="button"
              onClick={() => {
                void refresh();
              }}
              disabled={working}
              className="rounded-full border border-black/10 bg-white px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-ink transition hover:bg-parchment disabled:opacity-50"
            >
              Refresh thread
            </button>
          </div>
        </form>

        {error || actionError ? (
          <p className="mt-4 rounded-[18px] border border-blush/20 bg-blush/10 px-4 py-3 text-sm text-ink">
            {actionError ?? error}
          </p>
        ) : null}
        {actionMessage ? (
          <p className="mt-4 rounded-[18px] border border-black/10 bg-white px-4 py-3 text-sm text-ink">
            {actionMessage}
          </p>
        ) : null}
      </article>

      <article className="rounded-[28px] border border-black/10 bg-ink p-6 text-paper shadow-card">
        <p className="eyebrow text-[11px] text-paper/55">Pending approvals</p>
        <h3 className="display-title mt-2 text-3xl text-paper">Actions waiting on you.</h3>
        <p className="mt-3 text-sm leading-7 text-paper/72">
          Hybrid tools like outbound email stay gated here until the creator approves them.
          Telegram and dashboard approvals write to the same queue.
        </p>

        <div className="mt-6 space-y-4">
          {data.pendingApprovals.map((approval) => (
            <div
              key={approval.id}
              className="rounded-[22px] border border-white/10 bg-white/6 p-4"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-paper/60">
                {approval.type}
              </p>
              <p className="mt-2 text-lg font-semibold">{approval.description}</p>
              <p className="mt-3 text-sm leading-7 text-paper/72">{approval.preview}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  onClick={() => {
                    void handleApprove(approval.actionId);
                  }}
                  disabled={working}
                  className="rounded-full bg-paper px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-ink transition hover:bg-white disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  onClick={() => {
                    void handleSkip(approval.actionId);
                  }}
                  disabled={working}
                  className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-paper transition hover:bg-white/15 disabled:opacity-50"
                >
                  Skip
                </button>
              </div>
            </div>
          ))}

          {data.pendingApprovals.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-white/15 p-5 text-sm leading-7 text-paper/70">
              No actions are waiting on approval right now.
            </div>
          ) : null}
        </div>
      </article>
    </section>
  );
}
