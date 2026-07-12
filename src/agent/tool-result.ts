/**
 * Tool-result serialization with a model-safe size clamp.
 *
 * Any tool result that re-enters the LLM loop — registered tools (web search,
 * browser, enrichment, paid x402 APIs) and connected-app (Composio) tools alike
 * — can be far larger than the model accepts in a single follow-up call. A
 * single GMAIL_FETCH_EMAILS returns 60k–90k+ tokens of bodies + base64
 * attachments; a web scrape or file read can be just as big. Feeding that back
 * blows past the request/TPM limit and the next call throws, surfacing to the
 * user as "Sorry, I lost my train of thought."
 *
 * We clamp every result before it re-enters the loop so it fits, WITHOUT
 * silently dropping list items — otherwise the model receives, say, only 3 of
 * the 10 emails it asked for and then hallucinates a summary of "10". The clamp
 * keeps every item and instead shrinks the heavy per-item text (bodies/blobs)
 * progressively until the whole thing fits, preserving each item's useful
 * metadata (subject, sender, date, snippet, titles). App-agnostic so it protects
 * every current and future tool.
 */

const MAX_RESULT_ARRAY_ITEMS = 50;
// ~40k chars ≈ 10k tokens. Generous enough to keep a full list of items (e.g.
// 10 emails with their bodies) intact, yet a tiny fraction of the model's 128k
// context — the original failure was at 66k–90k *tokens* (260k–360k chars), so
// this stays far clear of request/TPM limits while never starving the list.
const MAX_RESULT_TOTAL_CHARS = 40000;
const MAX_DEPTH = 6;

const CLOSING_ENVELOPE = /<\/untrusted_external_data\s*>/gi;

function escapeSource(source: string): string {
  return source
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/** Wrap already-serialized external output without allowing it to close the envelope. */
export function wrapUntrustedExternalData(
  serialized: string,
  source: string,
): string {
  const inert = serialized.replace(
    CLOSING_ENVELOPE,
    "<\\/untrusted_external_data>",
  );
  return `<untrusted_external_data source="${escapeSource(source)}">\n${inert}\n</untrusted_external_data>`;
}

/** Serialize, clamp, and label external data before it can re-enter the model. */
export function serializeUntrustedExternalData(
  data: unknown,
  source: string,
): string {
  return wrapUntrustedExternalData(serializeToolResult(data), source);
}

// Per-string budgets tried from generous to tight. We keep all items and shrink
// their text until the serialized result fits, rather than truncating items off
// the end (which would make the model summarize fewer items than it claims).
const STRING_BUDGETS = [2000, 800, 350, 150, 60];

function clampResultValue(
  value: unknown,
  stringCap: number,
  depth = 0,
): unknown {
  if (typeof value === "string") {
    return value.length > stringCap
      ? `${value.slice(0, stringCap)}…[truncated ${value.length - stringCap} chars]`
      : value;
  }
  if (Array.isArray(value)) {
    if (depth > MAX_DEPTH) return `[array of ${value.length}]`;
    const capped: unknown[] = value
      .slice(0, MAX_RESULT_ARRAY_ITEMS)
      .map((v) => clampResultValue(v, stringCap, depth + 1));
    if (value.length > MAX_RESULT_ARRAY_ITEMS) {
      capped.push(
        `…[${value.length - MAX_RESULT_ARRAY_ITEMS} more items omitted]`,
      );
    }
    return capped;
  }
  if (value && typeof value === "object") {
    if (depth > MAX_DEPTH) return "[object]";
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = clampResultValue(v, stringCap, depth + 1);
    }
    return out;
  }
  return value;
}

/**
 * Serialize any tool result to a string, clamped to a model-safe size while
 * preserving every list item. Tries progressively tighter per-string budgets so
 * a long list (e.g. 10 emails) keeps all its items — just with shorter bodies —
 * instead of dropping the tail.
 */
export function serializeToolResult(data: unknown): string {
  for (const cap of STRING_BUDGETS) {
    let text: string;
    try {
      text = JSON.stringify(clampResultValue(data, cap)) ?? "";
    } catch {
      return String(data).slice(0, MAX_RESULT_TOTAL_CHARS);
    }
    if (text.length <= MAX_RESULT_TOTAL_CHARS) return text;
  }
  // Pathologically large even at the tightest budget — hard-cap as a last
  // resort and flag it so the model reports the partial result honestly.
  const tightest =
    JSON.stringify(clampResultValue(data, STRING_BUDGETS.at(-1)!)) ?? "";
  return `${tightest.slice(0, MAX_RESULT_TOTAL_CHARS)}…[result truncated — some items may be incomplete; say so rather than guessing]`;
}
