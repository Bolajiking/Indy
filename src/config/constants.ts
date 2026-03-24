export const SPENDING_LIMITS = {
  PER_TRANSACTION_USD: 5,
  DAILY_USD: 50,
  MONTHLY_USD: 500,
} as const;

export const FREE_CREDITS_USD = 10;

export const NETWORK = {
  TEMPO: {
    CHAIN_TYPE: "ethereum",
    CHAIN_ID: 42431,
    CAIP2: "eip155:42431",
    PATH_USD_DECIMALS: 6,
    PATH_USD_CONTRACT: "0x20c0000000000000000000000000000000000000",
    NAME: "Tempo Testnet",
  },
} as const;

export const AGENT = {
  MAX_STEPS_PER_TASK: 20,
  MORNING_SCAN_HOUR: 6,
  MORNING_BRIEF_HOUR: 7,
  DEFAULT_LLM: "claude-sonnet-4-6" as const,
  FAST_LLM: "claude-haiku-4-5-20251001" as const,
  /** Minimum combined balance (credits + wallet) required to start a paid task, in cents */
  MIN_TASK_COST_CENTS: 1,
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
