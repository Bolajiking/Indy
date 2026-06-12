import type Anthropic from "@anthropic-ai/sdk";
import type { JsonObject } from "../db/json.js";

/** Surface the creator's message arrived from. Drives channel-specific guidance
 * (e.g. connect cards render inline on the dashboard but not in messaging apps). */
export type AgentChannel = "dashboard" | "telegram" | "whatsapp";

export function asAgentChannel(value: unknown): AgentChannel | undefined {
  return value === "dashboard" || value === "telegram" || value === "whatsapp"
    ? value
    : undefined;
}

/** Core shape of an action awaiting creator approval, shared by the agent loop and agent responses. */
export interface PendingAgentAction {
  id: string;
  type: string;
  description: string;
  input: JsonObject;
}

export interface AgentResponse {
  text: string;
  requiresApproval: boolean;
  skill?: string;
  /** Services the agent asked the dashboard to surface connect prompts for */
  connections?: string[];
  pendingAction?: PendingAgentAction & {
    toolUseId?: string;
    messageHistory?: Anthropic.MessageParam[];
    systemPrompt?: string;
  };
}
