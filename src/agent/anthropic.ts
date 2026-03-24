import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { ipv4Fetch } from "../network/ipv4-fetch.js";

const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
  fetch: ipv4Fetch,
});

export default anthropic;
