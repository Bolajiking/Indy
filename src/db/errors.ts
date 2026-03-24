export const CREATOR_SERVICE_UNAVAILABLE_MESSAGE =
  "Creator service is temporarily unavailable. Please retry in a moment.";

export function isDatabaseServiceUnavailableError(error: unknown): boolean {
  if (!error) {
    return false;
  }

  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (code === "PGRST002") {
      return true;
    }
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }

  if (error instanceof Error) {
    const normalizedMessage = error.message.toLowerCase();
    if (
      error.name === "AbortError" ||
      normalizedMessage.includes("schema cache") ||
      normalizedMessage.includes("timed out") ||
      normalizedMessage.includes("timeout")
    ) {
      return true;
    }

    return isDatabaseServiceUnavailableError(error.cause);
  }

  return false;
}

export function isDatabaseUniqueViolationError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}
