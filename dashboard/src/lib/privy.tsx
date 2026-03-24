"use client";

import { PrivyProvider, usePrivy, type User } from "@privy-io/react-auth";
import {
  useCallback,
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  fetchAuthProfile,
  registerCreatorProfile,
  retryCreatorWalletProvisioning,
  updateCreatorProfile,
  type DashboardAuthResponse,
  type DashboardCreator,
  type DashboardOnboardingState,
  type DashboardProfileUpdateInput,
  type DashboardRegistrationInput,
} from "@/lib/api";
import {
  getSyncFailureFallback,
  resolveDashboardAuthStage,
  shouldSyncDashboardSession,
  type DashboardAuthStage,
} from "@/lib/auth-state";

interface AuthContextValue {
  ready: boolean;
  authenticated: boolean;
  user: User | null;
  accessToken: string | null;
  creator: DashboardCreator | null;
  onboarding: DashboardOnboardingState;
  stage: DashboardAuthStage;
  error: string | null;
  syncing: boolean;
  login: () => void;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  register: (input: DashboardRegistrationInput) => Promise<void>;
  updateProfile: (input: DashboardProfileUpdateInput) => Promise<void>;
  retryWalletProvisioning: () => Promise<void>;
}

const defaultOnboarding: DashboardOnboardingState = {
  status: "unregistered",
  walletProvisioned: false,
};

const AuthContext = createContext<AuthContextValue>({
  ready: false,
  authenticated: false,
  user: null,
  accessToken: null,
  creator: null,
  onboarding: defaultOnboarding,
  stage: "loading",
  error: null,
  syncing: false,
  login: () => {},
  logout: async () => {},
  refreshProfile: async () => {},
  register: async () => {},
  updateProfile: async () => {},
  retryWalletProvisioning: async () => {},
});

function applyProfileResponse(
  response: DashboardAuthResponse,
  setCreator: (creator: DashboardCreator | null) => void,
  setOnboarding: (onboarding: DashboardOnboardingState) => void
) {
  startTransition(() => {
    setCreator(response.creator);
    setOnboarding(response.onboarding);
  });
}

function MissingPrivyConfigProvider({ children }: { children: ReactNode }) {
  const value = useMemo<AuthContextValue>(
    () => ({
      ready: true,
      authenticated: false,
      user: null,
      accessToken: null,
      creator: null,
      onboarding: defaultOnboarding,
      stage: "signed_out",
      error:
        "Dashboard auth is not configured yet. Add PRIVY_APP_ID or NEXT_PUBLIC_PRIVY_APP_ID to the workspace env.",
      syncing: false,
      login: () => {},
      logout: async () => {},
      refreshProfile: async () => {},
      register: async () => {},
      updateProfile: async () => {},
      retryWalletProvisioning: async () => {},
    }),
    []
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function AuthBridge({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [creator, setCreator] = useState<DashboardCreator | null>(null);
  const [onboarding, setOnboarding] =
    useState<DashboardOnboardingState>(defaultOnboarding);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const creatorRef = useRef<DashboardCreator | null>(null);
  const onboardingRef = useRef<DashboardOnboardingState>(defaultOnboarding);
  const lastSyncedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    creatorRef.current = creator;
  }, [creator]);

  useEffect(() => {
    onboardingRef.current = onboarding;
  }, [onboarding]);

  const syncSession = useCallback(async () => {
    setSyncing(true);
    setError(null);

    try {
      const token = await getAccessToken();
      setAccessToken(token);

      if (!token) {
        lastSyncedUserIdRef.current = null;
        startTransition(() => {
          setCreator(null);
          setOnboarding(defaultOnboarding);
        });
        return;
      }

      const response = await fetchAuthProfile(token);
      applyProfileResponse(response, setCreator, setOnboarding);
      lastSyncedUserIdRef.current = user?.id ?? null;
    } catch (syncError) {
      const message =
        syncError instanceof Error ? syncError.message : "Unable to sync creator session";
      setError(message);
      const fallback = getSyncFailureFallback({
        creator: creatorRef.current,
        onboarding: onboardingRef.current,
        currentUserId: user?.id,
      });
      startTransition(() => {
        setCreator(fallback.creator);
        setOnboarding(fallback.onboarding);
      });
    } finally {
      setSyncing(false);
    }
  }, [getAccessToken, user?.id]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    if (!authenticated) {
      setAccessToken(null);
      setError(null);
      lastSyncedUserIdRef.current = null;
      startTransition(() => {
        setCreator(null);
        setOnboarding(defaultOnboarding);
      });
      return;
    }

    if (
      !shouldSyncDashboardSession({
        ready,
        authenticated,
        userId: user?.id,
        lastSyncedUserId: lastSyncedUserIdRef.current,
      })
    ) {
      return;
    }

    void syncSession();
  }, [authenticated, ready, syncSession, user?.id]);

  const register = useCallback(async (input: DashboardRegistrationInput) => {
    setSyncing(true);
    setError(null);

    try {
      const token = accessToken ?? (await getAccessToken());
      if (!token) {
        throw new Error("You need to sign in again before registering.");
      }

      setAccessToken(token);
      const response = await registerCreatorProfile(token, input);
      applyProfileResponse(response, setCreator, setOnboarding);
    } catch (registerError) {
      setError(
        registerError instanceof Error
          ? registerError.message
          : "Unable to register creator profile"
      );
      throw registerError;
    } finally {
      setSyncing(false);
    }
  }, [accessToken, getAccessToken]);

  const patchProfile = useCallback(async (input: DashboardProfileUpdateInput) => {
    setSyncing(true);
    setError(null);

    try {
      const token = accessToken ?? (await getAccessToken());
      if (!token) {
        throw new Error("You need to sign in again before updating your profile.");
      }

      setAccessToken(token);
      const response = await updateCreatorProfile(token, input);
      applyProfileResponse(response, setCreator, setOnboarding);
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to update creator profile"
      );
      throw updateError;
    } finally {
      setSyncing(false);
    }
  }, [accessToken, getAccessToken]);

  const retryWalletProvisioning = useCallback(async () => {
    setSyncing(true);
    setError(null);

    try {
      const token = accessToken ?? (await getAccessToken());
      if (!token) {
        throw new Error("You need to sign in again before retrying wallet setup.");
      }

      setAccessToken(token);
      const response = await retryCreatorWalletProvisioning(token);
      applyProfileResponse(response, setCreator, setOnboarding);
    } catch (retryError) {
      setError(
        retryError instanceof Error
          ? retryError.message
          : "Unable to retry wallet provisioning"
      );
      throw retryError;
    } finally {
      setSyncing(false);
    }
  }, [accessToken, getAccessToken]);

  const stage = resolveDashboardAuthStage({
    ready,
    authenticated,
    creator,
    onboarding,
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      authenticated,
      user,
      accessToken,
      creator,
      onboarding,
      stage,
      error,
      syncing,
      login: () => login(),
      logout,
      refreshProfile: async () => {
        lastSyncedUserIdRef.current = null;
        await syncSession();
      },
      register: async (input) => {
        await register(input);
      },
      updateProfile: async (input) => {
        await patchProfile(input);
      },
      retryWalletProvisioning: async () => {
        await retryWalletProvisioning();
      },
    }),
    [
      accessToken,
      authenticated,
      creator,
      error,
      login,
      logout,
      onboarding,
      patchProfile,
      ready,
      register,
      retryWalletProvisioning,
      stage,
      syncSession,
      syncing,
      user,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const clientId = process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID;

  if (!appId) {
    return <MissingPrivyConfigProvider>{children}</MissingPrivyConfigProvider>;
  }

  return (
    <PrivyProvider
      appId={appId}
      clientId={clientId || undefined}
      config={{
        appearance: {
          theme: "light",
          accentColor: "#734b38",
        },
        loginMethods: ["email", "google", "telegram"],
      }}
    >
      <AuthBridge>{children}</AuthBridge>
    </PrivyProvider>
  );
}
