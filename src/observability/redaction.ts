const SENSITIVE_KEY =
  /(^code$|authorization|cookie|secret|token|password|private.?key|service.?key|oauth.?code|email|message|body|content)/i;

function redactString(value: string): string {
  return value
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/(token|secret|password|code)=\S+/gi, "$1=[REDACTED]");
}

export function redactSensitive(
  value: unknown,
  key = "",
  seen = new WeakSet<object>(),
): unknown {
  if (SENSITIVE_KEY.test(key)) return "[REDACTED]";
  if (typeof value === "string") return redactString(value);
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  if (value instanceof Error) {
    return {
      name: value.name,
      // Provider errors frequently echo request bodies, signed URLs, or opaque
      // credentials in arbitrary prose. Keep the class for diagnosis while
      // withholding free-form message/stack text from logs.
      message: "[REDACTED]",
      stack: value.stack ? "[REDACTED]" : undefined,
      cause: redactSensitive(value.cause, "cause", seen),
    };
  }
  if (Array.isArray(value))
    return value.map((entry) => redactSensitive(entry, "", seen));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(
      ([entryKey, entry]) => [entryKey, redactSensitive(entry, entryKey, seen)],
    ),
  );
}
