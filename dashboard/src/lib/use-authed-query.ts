"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import { canAccessCreatorData } from "@/lib/auth-state";
import { useAuth } from "@/lib/auth-context";

interface AuthedQueryState<T> {
  data: T;
  error: string | null;
  isLoading: boolean;
  setData: Dispatch<SetStateAction<T>>;
  refresh: () => Promise<void>;
}

interface CacheEntry<T> {
  data: T;
  savedAt: number;
}

interface AuthedQueryOptions {
  staleMs?: number;
  revalidateOnFocus?: boolean;
  revalidateOnReconnect?: boolean;
}

const DEFAULT_STALE_MS = 30_000;
const memoryCache = new Map<string, CacheEntry<unknown>>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCacheEntry(value: unknown): value is CacheEntry<unknown> {
  return (
    isRecord(value) &&
    "data" in value &&
    typeof value.savedAt === "number" &&
    Number.isFinite(value.savedAt)
  );
}

// Stale-while-revalidate cache backed by sessionStorage.
// Cache keys are namespaced by creator id (see useAuthedQuery) so one creator's
// data can never be served to another after an account switch.
function readCache<T>(cacheKey: string): CacheEntry<T> | null {
  const memory = memoryCache.get(cacheKey);
  if (memory) {
    return memory as CacheEntry<T>;
  }

  try {
    const raw = sessionStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const entry = isCacheEntry(parsed)
      ? { data: parsed.data as T, savedAt: parsed.savedAt }
      : { data: parsed as T, savedAt: 0 };
    memoryCache.set(cacheKey, entry);
    return entry;
  } catch {
    return null;
  }
}

function writeCache<T>(cacheKey: string, data: T): void {
  const entry: CacheEntry<T> = { data, savedAt: Date.now() };
  memoryCache.set(cacheKey, entry);
  try {
    sessionStorage.setItem(cacheKey, JSON.stringify(entry));
  } catch {
    // sessionStorage quota or access errors — silently ignore
  }
}

function isFresh(cacheKey: string, staleMs: number): boolean {
  const cached = readCache<unknown>(cacheKey);
  return Boolean(cached && Date.now() - cached.savedAt < staleMs);
}

export function invalidateAuthedQueryCache(cacheKey?: string): void {
  if (cacheKey) {
    memoryCache.delete(cacheKey);
    try {
      sessionStorage.removeItem(cacheKey);
    } catch {}
    return;
  }

  memoryCache.clear();
}

export function useAuthedQuery<T>(
  loader: (accessToken: string) => Promise<T>,
  fallback: T,
  cacheKey?: string,
  options: AuthedQueryOptions = {},
): AuthedQueryState<T> {
  const { accessToken, stage, creator } = useAuth();
  const staleMs = options.staleMs ?? DEFAULT_STALE_MS;
  const revalidateOnFocus = options.revalidateOnFocus ?? true;
  const revalidateOnReconnect = options.revalidateOnReconnect ?? true;
  const fallbackRef = useRef(fallback);
  // Always keep a ref to the latest loader so an inline function recreated on
  // every render does not cause load → effect → re-fetch loops.
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  // Cache is only enabled once we know which creator the data belongs to.
  // Until then (and for unauthenticated views) we skip the cache entirely so a
  // previous user's cached data can never leak into a fresh session.
  const creatorId = creator?.id ?? null;
  const scopedKey =
    cacheKey && creatorId ? `${cacheKey}:${creatorId}` : undefined;

  // Pre-populate from sessionStorage cache so the UI renders instantly.
  const [data, setDataState] = useState<T>(() => {
    if (scopedKey) {
      const cached = readCache<T>(scopedKey);
      if (cached !== null) return cached.data;
    }
    return fallbackRef.current;
  });
  const [error, setError] = useState<string | null>(null);
  // If we have a cache hit, skip the loading state — data is already shown.
  const [isLoading, setIsLoading] = useState(() => {
    if (scopedKey) {
      const cached = readCache<T>(scopedKey);
      return cached === null; // only show loading shell when there's no cache
    }
    return true;
  });

  // inflight guard — prevents two concurrent fetches from racing each other
  const inflightRef = useRef(false);
  // abort controller ref — lets us cancel on unmount or re-trigger
  const abortRef = useRef<AbortController | null>(null);

  // load is stable per scopedKey — always reads the latest loader via ref.
  const load = useCallback(
    async (token: string, opts: { force?: boolean } = {}) => {
      if (!opts.force && scopedKey) {
        const cached = readCache<T>(scopedKey);
        if (cached && Date.now() - cached.savedAt < staleMs) {
          setDataState(cached.data);
          setIsLoading(false);
          setError(null);
          return;
        }
      }

      // Skip if a load is already in progress (deduplicate rapid refresh calls)
      if (inflightRef.current) return;

      // Abort any previous pending fetch
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      inflightRef.current = true;

      setError(null);

      try {
        const next = await loaderRef.current(token);
        if (!controller.signal.aborted) {
          setDataState(next);
          if (scopedKey) writeCache(scopedKey, next);
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load dashboard data",
          );
          setDataState(fallbackRef.current);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
        inflightRef.current = false;
      }
    },
    [scopedKey, staleMs],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!canAccessCreatorData(stage) || !accessToken) {
      setIsLoading(false);
      setError(null);
      setDataState(fallbackRef.current);
      return;
    }

    void load(accessToken);
  }, [accessToken, load, stage]);

  useEffect(() => {
    if (!accessToken || !canAccessCreatorData(stage) || !scopedKey) {
      return;
    }

    function revalidateIfStale() {
      if (!accessToken || isFresh(scopedKey!, staleMs)) {
        return;
      }
      void load(accessToken);
    }

    const onFocus = () => {
      if (revalidateOnFocus && document.visibilityState === "visible") {
        revalidateIfStale();
      }
    };
    const onOnline = () => {
      if (revalidateOnReconnect) {
        revalidateIfStale();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("online", onOnline);
    };
  }, [
    accessToken,
    scopedKey,
    load,
    revalidateOnFocus,
    revalidateOnReconnect,
    staleMs,
    stage,
  ]);

  // Stable refresh — memoized so callers using it in useCallback deps don't re-fire
  const refresh = useCallback(async () => {
    if (!accessToken || !canAccessCreatorData(stage)) {
      return;
    }
    inflightRef.current = false;
    await load(accessToken, { force: true });
  }, [accessToken, load, stage]);

  const setData = useCallback<Dispatch<SetStateAction<T>>>(
    (next) => {
      setDataState((current) => {
        const resolved =
          typeof next === "function"
            ? (next as (value: T) => T)(current)
            : next;
        if (scopedKey) {
          writeCache(scopedKey, resolved);
        }
        return resolved;
      });
    },
    [scopedKey],
  );

  return {
    data,
    error,
    isLoading,
    setData,
    refresh,
  };
}
