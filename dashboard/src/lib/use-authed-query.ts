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

export function useAuthedQuery<T>(
  loader: (accessToken: string) => Promise<T>,
  fallback: T
): AuthedQueryState<T> {
  const { accessToken, stage } = useAuth();
  const fallbackRef = useRef(fallback);
  // Always keep a ref to the latest loader so an inline function recreated on
  // every render does not cause load → effect → re-fetch loops.
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const [data, setData] = useState<T>(fallbackRef.current);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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

    setIsLoading(true);
    setError(null);

    try {
      const next = await loaderRef.current(token);
      // Ignore result if we were aborted (component unmounted or superseded)
      if (!controller.signal.aborted) {
        setData(next);
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
  }, []); // stable — never changes

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
