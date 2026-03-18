export const SPENDING_LIMITS = {
  PER_TRANSACTION_USD: 5,
  DAILY_USD: 50,
  MONTHLY_USD: 500,
} as const;

export const FREE_CREDITS_USD = 10;

export const AGENT = {
  MAX_STEPS_PER_TASK: 20,
  MORNING_SCAN_HOUR: 6,
  MORNING_BRIEF_HOUR: 7,
  DEFAULT_LLM: "claude-sonnet-4-20250514" as const,
  FAST_LLM: "claude-haiku-4-20250414" as const,
} as const;

export const DEAL_STAGES = [
  "discovered",
  "pitched",
  "responded",
  "negotiating",
  "contracted",
  "active",
  "completed",
  "lost",
] as const;

export type DealStage = (typeof DEAL_STAGES)[number];
