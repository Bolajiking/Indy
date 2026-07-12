import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/auth/session.js", () => ({
  authenticateAccessToken: vi.fn(),
}));
vi.mock("../../../src/db/queries/deals.js", () => ({
  createDeal: vi.fn(),
  getDealByIdForCreator: vi.fn(),
  getDealsForCreator: vi.fn(),
  updateDeal: vi.fn(),
  updateDealStage: vi.fn(),
}));

import { Hono } from "hono";
import { authenticateAccessToken } from "../../../src/auth/session.js";
import {
  createDeal,
  getDealByIdForCreator,
  updateDeal,
  updateDealStage,
} from "../../../src/db/queries/deals.js";
import { deals } from "../../../src/api/routes/deals.js";

const app = new Hono().route("/deals", deals);
const valid = { brandName: "Acme", estimatedValueCents: 1000 };

describe("deal mutation API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticateAccessToken).mockResolvedValue({
      accessToken: "token",
      creatorId: "creator-1",
      privyUserId: "did:privy:1",
    });
    vi.mocked(getDealByIdForCreator).mockResolvedValue({
      id: "deal-1",
    } as never);
    vi.mocked(createDeal).mockResolvedValue({
      id: "deal-1",
      ...valid,
    } as never);
    vi.mocked(updateDeal).mockResolvedValue({ id: "deal-1" } as never);
    vi.mocked(updateDealStage).mockResolvedValue({
      id: "deal-1",
      stage: "active",
    } as never);
  });

  async function post(body: unknown) {
    return app.request("/deals", {
      method: "POST",
      headers: {
        Authorization: "Bearer token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }

  it.each([
    ["brandContactEmail", { ...valid, brandContactEmail: "bad" }],
    ["sourceUrl", { ...valid, sourceUrl: "javascript:alert(1)" }],
    ["deadlineAt", { ...valid, deadlineAt: "tomorrow" }],
    ["fitScore", { ...valid, fitScore: 101 }],
    ["probability", { ...valid, probability: -1 }],
    ["estimatedValueCents", { ...valid, estimatedValueCents: -1 }],
    ["notes", { ...valid, notes: "x".repeat(10_001) }],
    ["unknownField", { ...valid, unknownField: true }],
  ])("returns stable field errors for invalid %s", async (field, body) => {
    const response = await post(body);
    expect(response.status).toBe(400);
    const result = await response.json();
    expect(result).toMatchObject({ error: "Validation failed" });
    expect(result.fieldErrors[field]).toBeDefined();
    expect(createDeal).not.toHaveBeenCalled();
  });

  it("maps a valid create without allowing the client to choose creator", async () => {
    expect((await post(valid)).status).toBe(201);
    expect(createDeal).toHaveBeenCalledWith(
      expect.objectContaining({ creator_id: "creator-1", brand_name: "Acme" }),
    );
  });

  it("rejects an invalid stage filter instead of broadening the query", async () => {
    const response = await app.request("/deals?stage=everything", {
      headers: { Authorization: "Bearer token" },
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      fieldErrors: { stage: ["Invalid deal stage"] },
    });
  });

  it("passes creator identity into every database mutation predicate", async () => {
    const patch = await app.request("/deals/deal-1", {
      method: "PATCH",
      headers: {
        Authorization: "Bearer token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ notes: "Updated" }),
    });
    expect(patch.status).toBe(200);
    expect(updateDeal).toHaveBeenCalledWith("creator-1", "deal-1", {
      notes: "Updated",
    });

    const stage = await app.request("/deals/deal-1/stage", {
      method: "PATCH",
      headers: {
        Authorization: "Bearer token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ stage: "active" }),
    });
    expect(stage.status).toBe(200);
    expect(updateDealStage).toHaveBeenCalledWith(
      "creator-1",
      "deal-1",
      "active",
    );
  });
});
