"use client";

import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import {
  useCallback,
  startTransition,
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
} from "@/lib/auth-state";
import {
  AuthContext,
  defaultOnboarding,
  type AuthContextValue,
} from "@/lib/auth-context";
import { invalidateAuthedQueryCache } from "@/lib/use-authed-query";

// Per-user cached auth profile so a returning user's creator, wallet, and
// onboarding state hydrate instantly on login (stale-while-revalidate) instead
// of flashing the loading/onboarding screens while the network fetch resolves.
// Keyed by Privy user id and `:`-scoped so purgeScopedCaches() clears it on
// account switch / logout.
const AUTH_PROFILE_CACHE_PREFIX = "indyfren_auth_profile:";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCachedAuthProfile(value: unknown): value is DashboardAuthResponse {
  return (
    isRecord(value) &&
    (value.creator === null || isRecord(value.creator)) &&
    isRecord(value.onboarding)
  );
}

function readCachedProfile(userId: string): DashboardAuthResponse | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`${AUTH_PROFILE_CACHE_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isCachedAuthProfile(parsed)) return null;
    // Only trust a cache that actually belongs to this user.
    if (parsed?.creator && parsed.creator.privy_user_id !== userId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedProfile(
  userId: string | null | undefined,
  response: DashboardAuthResponse,
) {
  if (!userId || typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      `${AUTH_PROFILE_CACHE_PREFIX}${userId}`,
      JSON.stringify(response),
    );
  } catch {}
}

// Wipe every creator-scoped data cache (keys of the form `indyfren_*:<creatorId>`)
// plus the in-memory cache. Non-scoped prefs like the theme are intentionally kept.
function purgeScopedCaches() {
  invalidateAuthedQueryCache();
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith("indyfren_") && key.includes(":")) {
        sessionStorage.removeItem(key);
      }
    }
  } catch {}
}

function applyProfileResponse(
  response: DashboardAuthResponse,
  setCreator: (creator: DashboardCreator | null) => void,
  setOnboarding: (onboarding: DashboardOnboardingState) => void,
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
      login: async () => {},
      logout: async () => {},
      refreshProfile: async () => {},
      register: async () => {},
      updateProfile: async () => {},
      retryWalletProvisioning: async () => {},
    }),
    [],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function AuthBridge({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, login, logout, getAccessToken } =
    usePrivy();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [creator, setCreator] = useState<DashboardCreator | null>(null);
  const [onboarding, setOnboarding] =
    useState<DashboardOnboardingState>(defaultOnboarding);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  // Whether the current session's profile has resolved at least once (from cache
  // or network). Drives the loading gate so existing users never flash onboarding.
  const [profileLoaded, setProfileLoaded] = useState(false);
  const creatorRef = useRef<DashboardCreator | null>(null);
  const onboardingRef = useRef<DashboardOnboardingState>(defaultOnboarding);
  const profileLoadedRef = useRef(false);
  const lastSyncedUserIdRef = useRef<string | null>(null);
  const prevUserIdRef = useRef<string | null>(null);

  const markProfileLoaded = useCallback((loaded: boolean) => {
    profileLoadedRef.current = loaded;
    setProfileLoaded(loaded);
  }, []);

  // Purge cached data whenever the signed-in identity changes (account switch or
  // logout) so one creator's deals/chat/wallet can never surface for another.
  useEffect(() => {
    const currentId = ready && authenticated ? (user?.id ?? null) : null;
    if (prevUserIdRef.current !== null && prevUserIdRef.current !== currentId) {
      purgeScopedCaches();
    }
    prevUserIdRef.current = currentId;
  }, [ready, authenticated, user?.id]);

  useEffect(() => {
    creatorRef.current = creator;
  }, [creator]);

  useEffect(() => {
    onboardingRef.current = onboarding;
  }, [onboarding]);

  const syncSession = useCallback(async () => {
    setError(null);

    // Optimistically hydrate from the per-user cache so a returning user's full
    // context (creator, wallet, onboarding) is on screen immediately — no
    // loading spinner, no onboarding flash — while we revalidate in the
    // background.
    const cached = user?.id ? readCachedProfile(user.id) : null;
    if (cached && !profileLoadedRef.current) {
      applyProfileResponse(cached, setCreator, setOnboarding);
      markProfileLoaded(true);
    }

    setSyncing(true);

    try {
      const token = await getAccessToken();
      setAccessToken(token);

      if (!token) {
        lastSyncedUserIdRef.current = null;
        markProfileLoaded(false);
        startTransition(() => {
          setCreator(null);
          setOnboarding(defaultOnboarding);
        });
        return;
      }

      const response = await fetchAuthProfile(token);
      applyProfileResponse(response, setCreator, setOnboarding);
      writeCachedProfile(user?.id, response);
      markProfileLoaded(true);
      lastSyncedUserIdRef.current = user?.id ?? null;
    } catch (syncError) {
      const message =
        syncError instanceof Error
          ? syncError.message
          : "Unable to sync creator session";
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
      // We have a definitive answer for this session (cached creator or none),
      // so stop holding the loading screen.
      markProfileLoaded(true);
    } finally {
      setSyncing(false);
    }
  }, [getAccessToken, markProfileLoaded, user?.id]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    if (!authenticated) {
      setAccessToken(null);
      setError(null);
      lastSyncedUserIdRef.current = null;
      markProfileLoaded(false);
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
  }, [authenticated, markProfileLoaded, ready, syncSession, user?.id]);

  const register = useCallback(
    async (input: DashboardRegistrationInput) => {
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
        writeCachedProfile(user?.id, response);
        markProfileLoaded(true);
      } catch (registerError) {
        setError(
          registerError instanceof Error
            ? registerError.message
            : "Unable to register creator profile",
        );
        throw registerError;
      } finally {
        setSyncing(false);
      }
    },
    [accessToken, getAccessToken, markProfileLoaded, user?.id],
  );

  const patchProfile = useCallback(
    async (input: DashboardProfileUpdateInput) => {
      setSyncing(true);
      setError(null);

      try {
        const token = accessToken ?? (await getAccessToken());
        if (!token) {
          throw new Error(
            "You need to sign in again before updating your profile.",
          );
        }

        setAccessToken(token);
        const response = await updateCreatorProfile(token, input);
        applyProfileResponse(response, setCreator, setOnboarding);
        writeCachedProfile(user?.id, response);
        markProfileLoaded(true);
      } catch (updateError) {
        setError(
          updateError instanceof Error
            ? updateError.message
            : "Unable to update creator profile",
        );
        throw updateError;
      } finally {
        setSyncing(false);
      }
    },
    [accessToken, getAccessToken, markProfileLoaded, user?.id],
  );

  const retryWalletProvisioning = useCallback(async () => {
    setSyncing(true);
    setError(null);

    try {
      const token = accessToken ?? (await getAccessToken());
      if (!token) {
        throw new Error(
          "You need to sign in again before retrying wallet setup.",
        );
      }

      setAccessToken(token);
      const response = await retryCreatorWalletProvisioning(token);
      applyProfileResponse(response, setCreator, setOnboarding);
      writeCachedProfile(user?.id, response);
      markProfileLoaded(true);
    } catch (retryError) {
      setError(
        retryError instanceof Error
          ? retryError.message
          : "Unable to retry wallet provisioning",
      );
      throw retryError;
    } finally {
      setSyncing(false);
    }
  }, [accessToken, getAccessToken, markProfileLoaded, user?.id]);

  const openLogin = useCallback(async () => {
    setError(null);

    if (!ready) {
      setError(
        "Privy is still initializing. If this persists, confirm the dashboard URL is allowed in your Privy app settings.",
      );
      return;
    }

    try {
      await login();
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "Unable to open Privy sign-in",
      );
    }
  }, [login, ready]);

  const stage = resolveDashboardAuthStage({
    ready,
    authenticated,
    creator,
    onboarding,
    profileLoaded,
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
      login: openLogin,
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
      openLogin,
      patchProfile,
      ready,
      register,
      retryWalletProvisioning,
      stage,
      syncSession,
      syncing,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
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
