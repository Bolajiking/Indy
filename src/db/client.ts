import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

const SUPABASE_REQUEST_TIMEOUT_MS = 12_000;

function createAbortError() {
  return new DOMException("The operation was aborted.", "AbortError");
}

async function supabaseFetch(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(createAbortError());
  }, SUPABASE_REQUEST_TIMEOUT_MS);
  const upstreamSignal = init?.signal;

  const abort = () => {
    controller.abort(upstreamSignal?.reason ?? createAbortError());
  };

  if (upstreamSignal) {
    if (upstreamSignal.aborted) {
      abort();
    } else {
      upstreamSignal.addEventListener("abort", abort, { once: true });
    }
  }

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
    upstreamSignal?.removeEventListener("abort", abort);
  }
}

export const supabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_KEY,
  {
    global: {
      fetch: supabaseFetch,
    },
  },
);
