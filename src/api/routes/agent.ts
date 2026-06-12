import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  getPendingApprovalByAction,
  getPendingApprovalsForCreator,
  markApprovalSkipped,
} from "../../bot/approval.js";
import { getConversationHistory } from "../../db/queries/messages.js";
import {
  getRequiredCreatorId,
  requireCreatorAuth,
} from "../middleware/auth.js";
import { processCreatorMessage } from "../../agent/conversation.js";
import {
  ApprovalExecutionError,
  executePendingApprovalAction,
} from "../../agent/approval-execution.js";
import type {
  ApiAgentApprovalResponse,
  ApiAgentMessageInput,
  ApiAgentMessageResponse,
  ApiAgentState,
} from "../contracts.js";

export const agent = new Hono();
agent.use("*", requireCreatorAuth);

agent.get("/state", async (c) => {
  const creatorId = getRequiredCreatorId(c);
  const [messages, pendingApprovals] = await Promise.all([
    getConversationHistory(creatorId, 50),
    getPendingApprovalsForCreator(creatorId),
  ]);

  return c.json({ messages, pendingApprovals } satisfies ApiAgentState);
});

agent.post("/messages", async (c) => {
  const creatorId = getRequiredCreatorId(c);

  let body: ApiAgentMessageInput;
  try {
    body = await c.req.json<ApiAgentMessageInput>();
  } catch {
    throw new HTTPException(400, {
      message: "Request body must be valid JSON",
    });
  }

  const { text } = body;
  if (!text?.trim()) {
    throw new HTTPException(400, { message: "Message text is required" });
  }

  const reply = await processCreatorMessage({
    creatorId,
    text: text.trim(),
    metadata: { platform: "dashboard" },
  });
  const [messages, pendingApprovals] = await Promise.all([
    getConversationHistory(creatorId, 50),
    getPendingApprovalsForCreator(creatorId),
  ]);

  return c.json({
    reply,
    messages,
    pendingApprovals,
  } satisfies ApiAgentMessageResponse);
});

agent.post("/approvals/:actionId/approve", async (c) => {
  const creatorId = getRequiredCreatorId(c);
  const actionId = c.req.param("actionId");

  try {
    const execution = await executePendingApprovalAction(creatorId, actionId);
    const pendingApprovals = await getPendingApprovalsForCreator(creatorId);
    return c.json({
      execution,
      pendingApprovals,
    } satisfies ApiAgentApprovalResponse);
  } catch (error) {
    if (error instanceof ApprovalExecutionError) {
      const status =
        error.code === "not_found"
          ? 404
          : error.code === "wallet_not_ready"
            ? 409
            : 422;

      throw new HTTPException(status, { message: error.message });
    }

    throw error;
  }
});

agent.post("/approvals/:actionId/skip", async (c) => {
  const creatorId = getRequiredCreatorId(c);
  const actionId = c.req.param("actionId");
  const approval = await getPendingApprovalByAction(creatorId, actionId);

  if (!approval) {
    throw new HTTPException(404, {
      message: "That action has expired or was already handled.",
    });
  }

  await markApprovalSkipped(actionId);
  const pendingApprovals = await getPendingApprovalsForCreator(creatorId);
  return c.json({ pendingApprovals } satisfies ApiAgentApprovalResponse);
});
