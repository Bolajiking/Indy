/**
 * Skill-router entry point for creator messages.
 *
 * Skill-specific intents run through `runSkill`; general conversation falls
 * back to the standard orchestrator.
 */

import pino from "#logger";
import { routeToSkill } from "./router.js";
import { runSkill } from "./skill-runner.js";
import { assembleContext } from "../memory.js";
import type { AgentChannel, AgentResponse } from "../types.js";

const log = pino({ name: "agent:os" });

export interface OSInput {
  creatorId: string;
  userMessage: string;
  walletId?: string;
  walletAddress?: string;
  channel?: AgentChannel;
}

export async function runAgentOS(input: OSInput): Promise<AgentResponse> {
  const { creatorId, userMessage, walletId, walletAddress, channel } = input;

  log.info(
    { creatorId, message: userMessage.slice(0, 80) },
    "AgentOS received message",
  );

  let contextSummary: string | undefined;
  try {
    const fullContext = await assembleContext(creatorId);
    contextSummary = fullContext.slice(0, 300);
  } catch (err) {
    log.warn(
      { err, creatorId },
      "Failed to assemble routing context; routing without context summary",
    );
  }

  const route = await routeToSkill(userMessage, contextSummary);

  if (route.skill === "general") {
    const { runAgent } = await import("../orchestrator.js");
    return runAgent(creatorId, userMessage, walletId, walletAddress, channel);
  }

  return runSkill({
    creatorId,
    skill: route.skill,
    userMessage,
    extractedParams: route.extractedParams,
    walletId,
    walletAddress,
    channel,
  });
}
