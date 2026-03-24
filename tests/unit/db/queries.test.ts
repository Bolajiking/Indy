import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the supabase client before imports
vi.mock("../../../src/db/client.js", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

// Import after mocking
import { findCreatorByTelegram, createCreator } from "../../../src/db/queries/creators.js";
import { createDeal } from "../../../src/db/queries/deals.js";
import {
  getTransactionsForCreator,
  logTransaction,
} from "../../../src/db/queries/transactions.js";
import { supabase } from "../../../src/db/client.js";

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

      (supabase.from as any).mockReturnValue({
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

      (supabase.from as any).mockReturnValue({
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

      const mockInsert = vi.fn().mockReturnThis();
      const mockSelect = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockDeal,
        error: null,
      });

      (supabase.from as any).mockReturnValue({
        insert: mockInsert,
      });
      mockInsert.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        single: mockSingle,
      });

      const result = await createDeal({
        creator_id: "creator123",
        brand_name: "Test Brand",
      });

      expect(result.stage).toBe("discovered");
      expect(supabase.from).toHaveBeenCalledWith("deals");
      expect(mockInsert).toHaveBeenCalledWith({
        stage: "discovered",
        creator_id: "creator123",
        brand_name: "Test Brand",
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

      (supabase.from as any).mockReturnValue({
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

      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: mockEq,
        }),
      });
      mockOrder.mockReturnValue({
        limit: mockLimit,
      });

      await getTransactionsForCreator("creator123", 10);

      expect(mockEq).toHaveBeenCalledWith("creator_id", "creator123");
      expect(mockOrder).toHaveBeenCalledWith("created_at", { ascending: false });
      expect(mockLimit).toHaveBeenCalledWith(10);
    });
  });
});
