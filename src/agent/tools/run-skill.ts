/**
 * run_skill tool — lets the general orchestrator delegate to specialized skill sub-agents.
 *
 * This is the core tool that implements the Agentic OS architecture: every distinct
 * capability is a skill sub-agent, and the orchestrator dispatches to them via this tool.
 */

import { registerTool } from "./registry.js";
import { runSkill } from "../os/skill-runner.js";
import type { SkillName } from "../os/router.js";

const VALID_SKILLS: SkillName[] = [
  "brand-deal-scanner",
  "rate-calculator",
  "pitch-generator",
  "contract-reviewer",
  "revenue-advisor",
  "financial-tracker",
  "morning-brief",
  "analytics-aggregator",
  "content-strategy",
  "inbox-triager",
  "calendar-manager",
  "seo-optimizer",
];

registerTool({
  name: "run_skill",
  description:
    "Delegate to a specialized skill sub-agent. Use this to invoke any of the 12 specialized skills: brand-deal-scanner, rate-calculator, pitch-generator, contract-reviewer, revenue-advisor, financial-tracker, morning-brief, analytics-aggregator, content-strategy, inbox-triager, calendar-manager, seo-optimizer",
  autonomyLevel: "autonomous",
  costCategory: "free",
  maxCostPerUseCents: 0,
  parameters: {
    skill: {
      type: "string",
      description:
        "The skill to run. One of: brand-deal-scanner, rate-calculator, pitch-generator, contract-reviewer, revenue-advisor, financial-tracker, morning-brief, analytics-aggregator, content-strategy, inbox-triager, calendar-manager, seo-optimizer",
      required: true,
    },
    message: {
      type: "string",
      description: "The user's request / task description for the skill",
      required: true,
    },
  },
  async execute(params, context) {
    const skill = params.skill as SkillName;
    const message = params.message as string;

    if (!VALID_SKILLS.includes(skill)) {
      return {
        success: false,
        data: `Unknown skill: ${skill}. Valid skills: ${VALID_SKILLS.join(", ")}`,
        error: "invalid_skill",
      };
    }

    const result = await runSkill({
      creatorId: context.creatorId,
      skill,
      userMessage: message,
      extractedParams: {},
    });

    if (result.requiresApproval && result.pendingAction) {
      return {
        success: true,
        data: {
          requiresApproval: true,
          pendingAction: result.pendingAction,
          message: result.text,
        },
      };
    }

    return {
      success: true,
      data: result.text,
    };
  },
});
