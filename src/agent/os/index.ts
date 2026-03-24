/**
 * Indyfren Agentic OS
 *
 * The central nervous system of the Indyfren agent. Every user message flows through here:
 *
 * 1. Route: classify intent → select skill sub-agent
 * 2. Load: skill knowledge doc + creator memory
 * 3. Run: skill sub-agent with specialized tools
 * 4. Learn: extract and persist learnings for self-improvement
 * 5. Return: result to user
 *
 * This creates a self-improving system where every interaction makes the agent
 * smarter about each specific creator.
 */

import pino from "pino";
import { routeToSkill } from "./router.js";
import { runSkill } from "./skill-runner.js";
import { assembleContext } from "../memory.js";
import type { AgentResponse } from "../orchestrator.js";

const log = pino({ name: "agent:os" });

export interface OSInput {
  creatorId: string;
  userMessage: string;
  walletId?: string;
  walletAddress?: string;
}

/**
 * Main OS entry point. Routes and executes all agent interactions.
 */
export async function runAgentOS(input: OSInput): Promise<AgentResponse> {
  const { creatorId, userMessage, walletId, walletAddress } = input;

  log.info({ creatorId, message: userMessage.slice(0, 80) }, "AgentOS received message");

  // Assemble lightweight context for routing (just enough for classification)
  let contextSummary: string | undefined;
  try {
    const fullContext = await assembleContext(creatorId);
    contextSummary = fullContext.slice(0, 300);
  } catch {
    // Non-critical
  }

  // Route to the right skill
  const route = await routeToSkill(userMessage, contextSummary);

  if (route.skill === "general") {
    // Fall back to the standard orchestrator for general conversation
    const { runAgent } = await import("../orchestrator.js");
    return runAgent(creatorId, userMessage, walletId, walletAddress);
  }

  // Run the specialized skill sub-agent
  return runSkill({
    creatorId,
    skill: route.skill,
    userMessage,
    extractedParams: route.extractedParams,
    walletId,
    walletAddress,
  });
}
