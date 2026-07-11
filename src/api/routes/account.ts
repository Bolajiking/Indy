import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  getRequiredCreatorId,
  requireCreatorAuth,
} from "../middleware/auth.js";
import {
  buildCreatorExport,
  getAccountDeletionByToken,
  getAccountDeletionOwnerByToken,
  requestAccountDeletion,
} from "../../db/queries/account-lifecycle.js";
import {
  enqueueAccountDeletion,
  retryAccountDeletion,
} from "../../jobs/account-deletion.js";
import type {
  ApiAccountDeletionInput,
  ApiAccountDeletionResponse,
} from "../contracts.js";
import { env } from "../../config/env.js";

export const ACCOUNT_DELETE_CONFIRMATION = "DELETE MY ACCOUNT";
export const account = new Hono();

function preventCaching(c: { header: (name: string, value: string) => void }) {
  c.header("Cache-Control", "no-store");
  c.header("Pragma", "no-cache");
}

account.get("/export", requireCreatorAuth, async (c) => {
  const creatorId = getRequiredCreatorId(c);
  const payload = await buildCreatorExport(creatorId);
  c.header("Cache-Control", "no-store");
  c.header("Pragma", "no-cache");
  c.header("Content-Type", "application/json; charset=utf-8");
  c.header(
    "Content-Disposition",
    `attachment; filename="indyfren-export-${new Date().toISOString().slice(0, 10)}.json"`,
  );
  return c.body(JSON.stringify(payload, null, 2));
});

account.delete("/", requireCreatorAuth, async (c) => {
  let input: ApiAccountDeletionInput;
  try {
    input = await c.req.json<ApiAccountDeletionInput>();
  } catch {
    throw new HTTPException(400, {
      message: "Request body must be valid JSON",
    });
  }
  if (input.confirmation !== ACCOUNT_DELETE_CONFIRMATION) {
    throw new HTTPException(400, {
      message: `Type ${ACCOUNT_DELETE_CONFIRMATION} exactly to continue`,
    });
  }
  const creatorId = getRequiredCreatorId(c);
  if (!env.ENABLE_JOBS) {
    throw new HTTPException(503, {
      message: "Account deletion is temporarily unavailable",
    });
  }
  const lifecycle = await requestAccountDeletion(creatorId);
  await enqueueAccountDeletion(creatorId);
  const { creatorId: _creatorId, ...publicLifecycle } = lifecycle;
  preventCaching(c);
  return c.json(
    {
      ...publicLifecycle,
      sessionEnds: false,
    } satisfies ApiAccountDeletionResponse,
    202,
  );
});

async function readReceiptToken(c: { req: { json: <T>() => Promise<T> } }) {
  try {
    const body = await c.req.json<{ receiptToken?: string }>();
    return body.receiptToken?.trim() ?? "";
  } catch {
    return "";
  }
}

account.post("/deletion/status", async (c) => {
  const receiptToken = await readReceiptToken(c);
  if (!receiptToken)
    throw new HTTPException(400, { message: "Receipt token is required" });
  const lifecycle = await getAccountDeletionByToken(receiptToken);
  if (!lifecycle)
    throw new HTTPException(404, {
      message: "Deletion receipt expired or invalid",
    });
  preventCaching(c);
  return c.json({
    ...lifecycle,
    sessionEnds: lifecycle.state === "completed",
  } satisfies ApiAccountDeletionResponse);
});

account.post("/deletion/retry", async (c) => {
  const receiptToken = await readReceiptToken(c);
  if (!receiptToken)
    throw new HTTPException(400, { message: "Receipt token is required" });
  const [creatorId, lifecycle] = await Promise.all([
    getAccountDeletionOwnerByToken(receiptToken),
    getAccountDeletionByToken(receiptToken),
  ]);
  if (!creatorId || !lifecycle)
    throw new HTTPException(404, {
      message: "Deletion receipt expired or invalid",
    });
  if (lifecycle.state !== "retryable-failure") {
    throw new HTTPException(409, {
      message: "Deletion is not waiting for retry",
    });
  }
  await retryAccountDeletion(creatorId);
  preventCaching(c);
  return c.json(
    {
      ...lifecycle,
      state: "requested",
      error: null,
      sessionEnds: false,
    } satisfies ApiAccountDeletionResponse,
    202,
  );
});
