import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { ipv4Fetch } from "../network/ipv4-fetch.js";

// Anthropic Messages API client. Honours AI_BASE_URL / AI_API_KEY so it can also
// target Anthropic-compatible gateways (OpenRouter, LiteLLM, self-hosted, …).
const anthropic = new Anthropic({
  apiKey: env.AI_API_KEY || env.ANTHROPIC_API_KEY,
  ...(env.AI_BASE_URL ? { baseURL: env.AI_BASE_URL } : {}),
  fetch: ipv4Fetch,
});

export default anthropic;
