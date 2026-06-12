/**
 * Unified LLM entry point.
 *
 * Every agent call site uses this instead of a provider SDK directly. It speaks
 * the Anthropic Messages shape (the internal contract) and dispatches to the
 * configured provider (AI_PROVIDER). Skills pass the tier sentinels
 * AGENT.DEFAULT_LLM / AGENT.FAST_LLM as `model`; this layer resolves them to the
 * concrete model id for the active provider.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { AGENT } from "../config/constants.js";
import anthropicClient from "./anthropic.js";
import { createOpenAIMessage } from "./providers/openai.js";

function resolveModel(model: string): string {
  if (env.AI_PROVIDER === "openai") {
    const fallbackDefault = env.AI_MODEL || "gpt-4o";
    const fallbackFast = env.AI_FAST_MODEL || env.AI_MODEL || "gpt-4o-mini";
    if (model === AGENT.DEFAULT_LLM) return fallbackDefault;
    if (model === AGENT.FAST_LLM) return fallbackFast;
    return model;
  }

  // anthropic: only override the tier sentinels when an explicit model is set.
  if (model === AGENT.DEFAULT_LLM && env.AI_MODEL) return env.AI_MODEL;
  if (model === AGENT.FAST_LLM && env.AI_FAST_MODEL) return env.AI_FAST_MODEL;
  return model;
}

export interface LlmClient {
  messages: {
    create(
      params: Anthropic.MessageCreateParamsNonStreaming,
    ): Promise<Anthropic.Message>;
  };
}

const llm: LlmClient = {
  messages: {
    create(params) {
      const model = resolveModel(params.model);

      if (env.AI_PROVIDER === "openai") {
        const baseURL = env.AI_BASE_URL || "https://api.openai.com/v1";
        const apiKey = env.AI_API_KEY || env.OPENAI_API_KEY;
        return createOpenAIMessage(
          { ...params, model },
          { baseURL, apiKey, model },
        );
      }

      return anthropicClient.messages.create({ ...params, model });
    },
  },
};

export default llm;
