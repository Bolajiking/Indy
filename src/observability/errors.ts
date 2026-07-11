export interface PublicErrorEnvelope {
  error: { code: string; message: string; requestId: string };
}

export function publicError(
  code: string,
  message: string,
  requestId: string,
): PublicErrorEnvelope {
  return { error: { code, message, requestId } };
}
