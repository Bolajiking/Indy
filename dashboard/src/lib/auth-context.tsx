"use client";

import { createContext, useContext } from "react";
import type { User } from "@privy-io/react-auth";

import type {
  DashboardCreator,
  DashboardOnboardingState,
  DashboardProfileUpdateInput,
  DashboardRegistrationInput,
} from "@/lib/api";
import type { DashboardAuthStage } from "@/lib/auth-state";

export interface AuthContextValue {
  ready: boolean;
  authenticated: boolean;
  user: User | null;
  accessToken: string | null;
  creator: DashboardCreator | null;
  onboarding: DashboardOnboardingState;
  stage: DashboardAuthStage;
  error: string | null;
  syncing: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  register: (input: DashboardRegistrationInput) => Promise<void>;
  updateProfile: (input: DashboardProfileUpdateInput) => Promise<void>;
  retryWalletProvisioning: () => Promise<void>;
}

export const defaultOnboarding: DashboardOnboardingState = {
  status: "unregistered",
  walletProvisioned: false,
};

export const AuthContext = createContext<AuthContextValue>({
  ready: false,
  authenticated: false,
  user: null,
  accessToken: null,
  creator: null,
  onboarding: defaultOnboarding,
  stage: "loading",
  error: null,
  syncing: false,
  login: async () => {},
  logout: async () => {},
  refreshProfile: async () => {},
  register: async () => {},
  updateProfile: async () => {},
  retryWalletProvisioning: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}
