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
import { useAuth } from "@/lib/privy";

interface AuthedQueryState<T> {
  data: T;
  error: string | null;
  isLoading: boolean;
  setData: Dispatch<SetStateAction<T>>;
  refresh: () => Promise<void>;
}

// Stale-while-revalidate cache backed by sessionStorage.
// Keyed per cacheKey — data is served instantly on mount, then refreshed in background.
function readCache<T>(cacheKey: string): T | null {
  try {
    const raw = sessionStorage.getItem(cacheKey);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeCache<T>(cacheKey: string, data: T): void {
  try {
    sessionStorage.setItem(cacheKey, JSON.stringify(data));
  } catch {
    // sessionStorage quota or access errors — silently ignore
  }
}

export function useAuthedQuery<T>(
  loader: (accessToken: string) => Promise<T>,
  fallback: T,
  cacheKey?: string
): AuthedQueryState<T> {
  const { accessToken, stage } = useAuth();
  const fallbackRef = useRef(fallback);
  // Always keep a ref to the latest loader so an inline function recreated on
  // every render does not cause load → effect → re-fetch loops.
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  // Pre-populate from sessionStorage cache so the UI renders instantly.
  const [data, setData] = useState<T>(() => {
    if (cacheKey) {
      const cached = readCache<T>(cacheKey);
      if (cached !== null) return cached;
    }
    return fallbackRef.current;
  });
  const [error, setError] = useState<string | null>(null);
  // If we have a cache hit, skip the loading state — data is already shown.
  const [isLoading, setIsLoading] = useState(() => {
    if (cacheKey) {
      const cached = readCache<T>(cacheKey);
      return cached === null; // only show loading shell when there's no cache
    }
    return false;
  });

  // inflight guard — prevents two concurrent fetches from racing each other
  const inflightRef = useRef(false);
  // abort controller ref — lets us cancel on unmount or re-trigger
  const abortRef = useRef<AbortController | null>(null);

  // load is stable (empty deps) — always reads the latest loader via ref.
  const load = useCallback(async (token: string) => {
    // Skip if a load is already in progress (deduplicate rapid refresh calls)
    if (inflightRef.current) return;

    // Abort any previous pending fetch
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    inflightRef.current = true;

    // Don't set isLoading=true when revalidating stale data — keeps the existing
    // cached content visible without a loading flash.
    setError(null);

    try {
      const next = await loaderRef.current(token);
      // Ignore result if we were aborted (component unmounted or superseded)
      if (!controller.signal.aborted) {
        setData(next);
        if (cacheKey) writeCache(cacheKey, next);
      }
    } catch (loadError) {
      if (!controller.signal.aborted) {
        setError(
          loadError instanceof Error ? loadError.message : "Unable to load dashboard data"
        );
        setData(fallbackRef.current);
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
      inflightRef.current = false;
    }
  }, [cacheKey]); // cacheKey is stable at call site

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
      setData(fallbackRef.current);
      return;
    }

    void load(accessToken);
  }, [accessToken, load, stage]); // load is stable — only fires when token or stage changes

  // Stable refresh — memoized so callers using it in useCallback deps don't re-fire
  const refresh = useCallback(async () => {
    if (!accessToken || !canAccessCreatorData(stage)) {
      return;
    }
    // Reset inflight guard for manual refreshes (user explicitly requested)
    inflightRef.current = false;
    await load(accessToken);
  }, [accessToken, load, stage]);

  return {
    data,
    error,
    isLoading,
    setData,
    refresh,
  };
}
