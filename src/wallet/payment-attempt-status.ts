const PAYMENT_ATTEMPT_STATUSES = [
  "started",
  "challenge_created",
  "credential_created",
  "succeeded",
  "failed",
] as const;

export type PaymentAttemptStatus = (typeof PAYMENT_ATTEMPT_STATUSES)[number];
