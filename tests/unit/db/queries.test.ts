import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the supabase client before imports
vi.mock("../../../src/db/client.js", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

// Import after mocking
import {
  findCreatorByTelegram,
  createCreator,
} from "../../../src/db/queries/creators.js";
import { createDeal } from "../../../src/db/queries/deals.js";
import {
  getTransactionsForCreator,
  logTransaction,
} from "../../../src/db/queries/transactions.js";
import {
  createPaymentAttempt,
  updatePaymentAttempt,
} from "../../../src/db/queries/payment-attempts.js";
import { upsertConnection } from "../../../src/db/queries/platform-connections.js";
import { supabase } from "../../../src/db/client.js";

function mockSupabaseFrom(result: unknown): void {
  vi.mocked(supabase.from).mockReturnValue(result as never);
}

describe("Database Queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("creators", () => {
    it("should return null when creator not found by telegram", async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { code: "PGRST116" },
      });

      mockSupabaseFrom({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockReturnValue({
        single: mockSingle,
      });

      const result = await findCreatorByTelegram("nonexistent");

      expect(result).toBeNull();
      expect(supabase.from).toHaveBeenCalledWith("creators");
      expect(mockSelect).toHaveBeenCalledWith("*");
      expect(mockEq).toHaveBeenCalledWith("telegram_chat_id", "nonexistent");
    });

    it("should create a creator", async () => {
      const mockCreator = {
        id: "123",
        telegram_chat_id: "chat123",
        display_name: "Test Creator",
        free_credits_remaining_cents: 1000,
        monthly_spend_cents: 0,
        settings: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockInsert = vi.fn().mockReturnThis();
      const mockSelect = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockCreator,
        error: null,
      });

      mockSupabaseFrom({
        insert: mockInsert,
      });
      mockInsert.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        single: mockSingle,
      });

      const result = await createCreator({
        telegram_chat_id: "chat123",
        display_name: "Test Creator",
      });

      expect(result).toEqual(mockCreator);
      expect(supabase.from).toHaveBeenCalledWith("creators");
    });
  });

  describe("deals", () => {
    it("should create a deal with stage set to discovered", async () => {
      const mockDeal = {
        id: "deal123",
        creator_id: "creator123",
        brand_name: "Test Brand",
        stage: "discovered",
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockExistingSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockIlike = vi.fn().mockReturnThis();
      const mockNot = vi.fn().mockReturnThis();
      const mockOrder = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockReturnThis();
      const mockMaybeSingle = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      const mockInsert = vi.fn().mockReturnThis();
      const mockInsertSelect = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockDeal,
        error: null,
      });

      mockSupabaseFrom({
        select: mockExistingSelect,
        insert: mockInsert,
      });
      mockExistingSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ ilike: mockIlike });
      mockIlike.mockReturnValue({ not: mockNot });
      mockNot.mockReturnValue({ order: mockOrder });
      mockOrder.mockReturnValue({ limit: mockLimit });
      mockLimit.mockReturnValue({ maybeSingle: mockMaybeSingle });
      mockInsert.mockReturnValue({
        select: mockInsertSelect,
      });
      mockInsertSelect.mockReturnValue({
        single: mockSingle,
      });

      const result = await createDeal({
        creator_id: "creator123",
        brand_name: "Test Brand",
      });

      expect(result.stage).toBe("discovered");
      expect(supabase.from).toHaveBeenCalledWith("deals");
      expect(mockExistingSelect).toHaveBeenCalledWith("*");
      expect(mockEq).toHaveBeenCalledWith("creator_id", "creator123");
      expect(mockIlike).toHaveBeenCalledWith("brand_name", "Test Brand");
      expect(mockInsert).toHaveBeenCalledWith({
        stage: "discovered",
        creator_id: "creator123",
        brand_name: "Test Brand",
        source_evidence: [],
        deliverables: [],
        agent_provenance: {},
        metadata: {},
      });
    });
  });

  describe("transactions", () => {
    it("defaults metadata to an empty object when logging a transaction", async () => {
      const mockTransaction = {
        id: "tx123",
        creator_id: "creator123",
        type: "mpp_payment",
        amount_cents: 250,
        currency: "USD",
        description: "MPP payment to example.com",
        service: "example.com",
        tx_hash: "0xabc",
        metadata: {},
        created_at: new Date().toISOString(),
      };

      const mockInsert = vi.fn().mockReturnThis();
      const mockSelect = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockTransaction,
        error: null,
      });

      mockSupabaseFrom({
        insert: mockInsert,
      });
      mockInsert.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        single: mockSingle,
      });

      await logTransaction({
        creator_id: "creator123",
        type: "mpp_payment",
        amount_cents: 250,
        description: "MPP payment to example.com",
        service: "example.com",
        tx_hash: "0xabc",
      });

      expect(mockInsert).toHaveBeenCalledWith({
        creator_id: "creator123",
        type: "mpp_payment",
        amount_cents: 250,
        currency: "USD",
        description: "MPP payment to example.com",
        service: "example.com",
        tx_hash: "0xabc",
        metadata: {},
      });
    });

    it("applies the requested limit when fetching creator transactions", async () => {
      const mockOrder = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({
        order: mockOrder,
      });

      mockSupabaseFrom({
        select: vi.fn().mockReturnValue({
          eq: mockEq,
        }),
      });
      mockOrder.mockReturnValue({
        limit: mockLimit,
      });

      await getTransactionsForCreator("creator123", 10);

      expect(mockEq).toHaveBeenCalledWith("creator_id", "creator123");
      expect(mockOrder).toHaveBeenCalledWith("created_at", {
        ascending: false,
      });
      expect(mockLimit).toHaveBeenCalledWith(10);
    });
  });

  describe("platform connections", () => {
    it("encrypts platform credentials at the query boundary", async () => {
      let persistedConnection:
        | Parameters<typeof upsertConnection>[0]
        | undefined;

      const mockUpsert = vi
        .fn()
        .mockImplementation(
          (connection: Parameters<typeof upsertConnection>[0]) => {
            persistedConnection = connection;
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: "conn-1",
                    created_at: new Date().toISOString(),
                    ...connection,
                  },
                  error: null,
                }),
              }),
            };
          },
        );

      mockSupabaseFrom({
        upsert: mockUpsert,
      });

      const result = await upsertConnection({
        creator_id: "creator123",
        platform: "youtube",
        access_token: "raw-access-token",
        refresh_token: "raw-refresh-token",
        platform_user_id: null,
        platform_username: "creator-channel",
        metadata: {},
        expires_at: null,
      });

      expect(supabase.from).toHaveBeenCalledWith("platform_connections");
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          creator_id: "creator123",
          platform: "youtube",
          access_token: expect.stringMatching(/^v1:/),
          refresh_token: expect.stringMatching(/^v1:/),
        }),
        { onConflict: "creator_id,platform" },
      );
      expect(persistedConnection?.access_token).not.toBe("raw-access-token");
      expect(result.access_token).toBe("raw-access-token");
      expect(result.refresh_token).toBe("raw-refresh-token");
    });
  });

  describe("payment attempts", () => {
    it("creates an observable MPP payment attempt before settlement", async () => {
      const mockAttempt = {
        id: "attempt-1",
        creator_id: "creator123",
        service_url: "https://parallelmpp.dev/api/search",
        service_host: "parallelmpp.dev",
        method: "tempo",
        intent: "charge",
        currency: "0x20c0000000000000000000000000000000000000",
        quoted_amount_cents: 1,
        actual_amount_cents: null,
        status: "challenge_created",
        challenge_id: "challenge-1",
        receipt_reference: null,
        tx_hash: null,
        error: null,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockInsert = vi.fn().mockReturnThis();
      const mockSelect = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockAttempt,
        error: null,
      });

      mockSupabaseFrom({
        insert: mockInsert,
      });
      mockInsert.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        single: mockSingle,
      });

      await createPaymentAttempt({
        creator_id: "creator123",
        service_url: "https://parallelmpp.dev/api/search",
        service_host: "parallelmpp.dev",
        method: "tempo",
        intent: "charge",
        currency: "0x20c0000000000000000000000000000000000000",
        quoted_amount_cents: 1,
        status: "challenge_created",
        challenge_id: "challenge-1",
      });

      expect(supabase.from).toHaveBeenCalledWith("payment_attempts");
      expect(mockInsert).toHaveBeenCalledWith({
        creator_id: "creator123",
        service_url: "https://parallelmpp.dev/api/search",
        service_host: "parallelmpp.dev",
        method: "tempo",
        intent: "charge",
        currency: "0x20c0000000000000000000000000000000000000",
        quoted_amount_cents: 1,
        status: "challenge_created",
        challenge_id: "challenge-1",
        metadata: {},
      });
    });

    it("updates payment attempts with receipt reconciliation fields", async () => {
      const mockUpdate = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockSelect = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: "attempt-1", status: "succeeded" },
        error: null,
      });

      mockSupabaseFrom({
        update: mockUpdate,
      });
      mockUpdate.mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        single: mockSingle,
      });

      await updatePaymentAttempt("attempt-1", {
        status: "succeeded",
        actual_amount_cents: 1,
        receipt_reference: "0xreceipt",
        tx_hash: "0xreceipt",
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "succeeded",
          actual_amount_cents: 1,
          receipt_reference: "0xreceipt",
          tx_hash: "0xreceipt",
          updated_at: expect.any(String),
        }),
      );
      expect(mockEq).toHaveBeenCalledWith("id", "attempt-1");
    });
  });
});
