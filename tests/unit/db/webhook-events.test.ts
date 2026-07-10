import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/db/client.js", () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from "../../../src/db/client.js";
import {
  markPendingWebhookLeaseOutcomeUnknown,
  markWebhookProcessed,
} from "../../../src/db/queries/webhook-events.js";

describe("webhook event delivery leases", () => {
  beforeEach(() => vi.clearAllMocks());

  it("atomically sends an unacquired pending lease to reconciliation", async () => {
    const final = Promise.resolve({ error: null });
    const outcome = { eq: vi.fn(() => final) };
    const status = { eq: vi.fn(() => outcome) };
    const event = { eq: vi.fn(() => status) };
    const provider = { eq: vi.fn(() => event) };
    const update = vi.fn(() => provider);
    vi.mocked(supabase.from).mockReturnValue({ update } as never);

    await markPendingWebhookLeaseOutcomeUnknown("telegram", "42");

    expect(update).toHaveBeenCalledWith({
      status: "outcome_unknown",
      delivery_outcome: "unknown",
      error: "Webhook delivery outcome requires reconciliation",
      updated_at: expect.any(String),
    });
    expect(provider.eq).toHaveBeenCalledWith("provider", "telegram");
    expect(event.eq).toHaveBeenCalledWith("provider_event_id", "42");
    expect(status.eq).toHaveBeenCalledWith("status", "processing");
    expect(outcome.eq).toHaveBeenCalledWith("delivery_outcome", "pending");
  });

  it("permits the original token to record a late success after reconciliation", async () => {
    const final = Promise.resolve({ data: { id: "event-id" }, error: null });
    const single = { maybeSingle: vi.fn(() => final) };
    const selection = { select: vi.fn(() => single) };
    const token = { eq: vi.fn(() => selection) };
    const event = { eq: vi.fn(() => token) };
    const provider = { eq: vi.fn(() => event) };
    const select = vi.fn(() => provider);
    const update = vi.fn(() => ({ eq: provider.eq, select }));
    vi.mocked(supabase.from).mockReturnValue({ update } as never);

    await markWebhookProcessed("telegram", "42", "original-lease-token");

    expect(event.eq).toHaveBeenCalledWith("provider_event_id", "42");
    expect(token.eq).toHaveBeenCalledWith(
      "delivery_lease_token",
      "original-lease-token",
    );
    expect(provider.eq).not.toHaveBeenCalledWith("status", expect.anything());
    expect(provider.eq).not.toHaveBeenCalledWith(
      "delivery_outcome",
      expect.anything(),
    );
  });
});
