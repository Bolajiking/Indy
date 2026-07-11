import type { DealStage } from "../config/constants.js";
import type { AggregatedAnalytics } from "../agent/skills/analytics-aggregator.js";
import type { FinancialSnapshot } from "../agent/skills/financial-tracker.js";
import type { JsonObject } from "../db/json.js";
import type { MessagingPlatform } from "../messaging/types.js";
import type { PaymentAttemptStatus } from "../wallet/payment-attempt-status.js";
import type { CreatorSpendingLimits } from "../wallet/spending.js";

export type ApiDealStage = DealStage;

export interface ApiDeal {
  id: string;
  brand_name: string;
  brand_contact_email: string | null;
  brand_contact_name: string | null;
  brand_domain?: string | null;
  stage: ApiDealStage;
  fit_score: number | null;
  estimated_value_cents: number | null;
  actual_value_cents: number | null;
  source_url?: string | null;
  source_type?: string | null;
  source_confidence?: number | null;
  source_evidence?: JsonObject[];
  deliverables?: JsonObject[];
  deadline_at?: string | null;
  follow_up_at?: string | null;
  probability?: number | null;
  next_action?: string | null;
  agent_provenance?: JsonObject;
  archived_at?: string | null;
  pitch_text: string | null;
  pitch_sent_at: string | null;
  response_text: string | null;
  responded_at: string | null;
  contract_notes: string | null;
  notes: string | null;
  metadata: JsonObject;
  created_at: string;
  updated_at: string;
}

export interface ApiDealStageUpdateInput {
  stage: ApiDealStage;
}

export interface ApiTransaction {
  id: string;
  type: string;
  amount_cents: number;
  currency: string;
  description: string;
  service: string | null;
  status?: string | null;
  error?: string | null;
  created_at: string;
}

export type ApiPaymentAttemptStatus = PaymentAttemptStatus;

export interface ApiPaymentAttempt {
  id: string;
  service_url: string;
  service_host: string;
  method: string | null;
  intent: string | null;
  currency: string | null;
  quoted_amount_cents: number | null;
  actual_amount_cents: number | null;
  status: ApiPaymentAttemptStatus;
  challenge_id: string | null;
  receipt_reference: string | null;
  tx_hash: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiCreatorProfile {
  id: string;
  display_name: string;
  niche: string | null;
  wallet_id: string | null;
  wallet_address: string | null;
  privy_user_id: string | null;
  telegram_chat_id: string | null;
  whatsapp_phone: string | null;
  settings: JsonObject | null;
}

export interface ApiOnboardingState {
  status: string;
  walletProvisioned: boolean;
  walletProvisioningInProgress?: boolean;
  walletProvisioningAttempts?: number;
  walletProvisioningLastError?: string | null;
  onboardingComplete?: boolean;
}

export interface ApiAuthProfileResponse {
  creator: ApiCreatorProfile | null;
  onboarding: ApiOnboardingState;
  isNew?: boolean;
}

export interface ApiRegistrationInput {
  displayName: string;
  niche?: string;
}

export interface ApiProfileUpdateInput {
  displayName?: string;
  niche?: string;
  settings?: JsonObject;
}

export interface ApiOnboardingContextInput {
  platforms: string[];
  followerRange: string;
  currentRateUsd?: number;
  monthlyTargetUsd?: number;
  goals: string[];
  experienceLevel: string;
}

export interface ApiPlatformConnection {
  id?: string;
  platform: string;
  platform_username: string | null;
  platform_user_id?: string | null;
  connected: boolean;
  created_at?: string;
}

export interface ApiPlatformConnectionInput {
  platform: string;
  accessToken: string;
  username?: string;
  refreshToken?: string;
  userId?: string;
  expiresAt?: string;
}

export type ApiMessagingPlatform = MessagingPlatform;

export interface ApiMessagingLink {
  platform: ApiMessagingPlatform;
  token: string;
  expiresAt: string;
  command: string;
  launchUrl: string | null;
}

export interface ApiPlatformOAuthProvider {
  platform: string;
  enabled: boolean;
  authorizationUrl: string;
  scope: string;
}

export interface ApiMessage {
  id: string;
  creator_id: string;
  role: string;
  content: string;
  metadata: JsonObject | null;
  created_at: string;
}

export interface ApiPendingApproval {
  id: string;
  creatorId: string;
  actionId: string;
  type: string;
  description: string;
  preview: string;
  input: JsonObject;
}

export interface ApiAgentReply {
  text: string;
  requiresApproval: boolean;
  /** Services the agent asked the dashboard to surface connect prompts for */
  connections?: string[];
  pendingAction?: {
    id: string;
    type: string;
    description: string;
    input: JsonObject;
  };
}

export interface ApiAgentState {
  messages: ApiMessage[];
  pendingApprovals: ApiPendingApproval[];
}

export interface ApiAgentMessageInput {
  text?: string;
}

export interface ApiAgentMessageResponse extends ApiAgentState {
  reply: ApiAgentReply;
}

export interface ApiAgentApprovalResponse {
  execution?: {
    message: string;
    costCents?: number;
  };
  pendingApprovals: ApiPendingApproval[];
}

export interface ApiWalletBalance {
  balanceCents: number;
  balanceFormatted: string;
  walletAddress: string | null;
  fundingMode?: "tempo_testnet_faucet";
  lowBalance?: boolean;
  minimumRecommendedBalanceCents?: number;
  spendingLimits?: CreatorSpendingLimits;
  network?: {
    name: string;
    chainId: number;
    rpcUrl: string;
    currency: string;
    tokenAddress: string;
    tokenDecimals: number;
  };
  fundingInstructions?: {
    title: string;
    description: string;
    faucetRpcMethod: string;
  };
  error?: string;
}

export type ApiAccountDeletionState =
  | "requested"
  | "revoking-connections"
  | "deleting"
  | "completed"
  | "retryable-failure";

export interface ApiAccountDeletionInput {
  confirmation: string;
}

export interface ApiAccountDeletionResponse {
  state: ApiAccountDeletionState;
  residuals: Array<{ kind: string; identifier?: string; detail: string }>;
  error?: string | null;
  receiptToken?: string;
  receiptExpiresAt?: string;
  /** True only after cleanup completed; then the dashboard purges and logs out. */
  sessionEnds: boolean;
}

export interface ApiConnectionAccount {
  toolkit: string;
  status: string;
  connected: boolean;
}

export interface ApiConnectionsInfo {
  enabled: boolean;
  toolkits: string[];
  accounts: ApiConnectionAccount[];
}

export interface ApiConnectionInitiateResponse {
  redirectUrl: string;
}

export interface ApiConnectionDisconnectResponse {
  disconnected: number;
}

export type ApiFinancialSnapshot = FinancialSnapshot;
export type ApiAggregatedAnalytics = AggregatedAnalytics;
