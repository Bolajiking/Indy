import { describe, it, expect, vi, beforeEach } from "vitest";
import { splitMessage } from "../../../src/bot/telegram.js";
import { handleMessage } from "../../../src/bot/handler.js";
import {
  findCreatorByTelegram,
  createCreator,
} from "../../../src/db/queries/creators.js";
import { getCalendarView } from "../../../src/agent/skills/calendar-manager.js";
import { generateFinancialSnapshot } from "../../../src/agent/skills/financial-tracker.js";
import { generateContentStrategy } from "../../../src/agent/skills/content-strategy.js";

// Mock dependencies
vi.mock("../../../src/db/queries/creators.js");
vi.mock("../../../src/db/queries/messages.js");
vi.mock("../../../src/wallet/provisioning.js");
vi.mock("../../../src/agent/orchestrator.js");
vi.mock("../../../src/agent/skills/calendar-manager.js");
vi.mock("../../../src/agent/skills/financial-tracker.js");
vi.mock("../../../src/agent/skills/content-strategy.js");
vi.mock("../../../src/bot/formatters.js", () => ({
  formatFinancialSnapshot: () => "💰 Financial Snapshot formatted",
  formatContentStrategy: () => "📅 Content Strategy formatted",
}));

const mockCreator = {
  id: "creator-123",
  display_name: "TestCreator",
  telegram_chat_id: "12345",
  wallet_id: null,
  wallet_address: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe("Telegram Bot Improvements", () => {
  describe("Message Splitting", () => {
    it("should not split messages under 4096 characters", () => {
      const shortMessage = "Hello world";
      const result = splitMessage(shortMessage);
      expect(result).toEqual([shortMessage]);
    });

    it("should split long messages into multiple chunks", () => {
      const longMessage = "a".repeat(5000);
      const result = splitMessage(longMessage);
      expect(result.length).toBeGreaterThan(1);
      expect(result.every((chunk) => chunk.length <= 4096)).toBe(true);
    });

    it("should prefer breaking at newlines when possible", () => {
      const message = "a".repeat(4100) + "\nSecond part";
      const result = splitMessage(message);
      expect(result.length).toBeGreaterThan(1);
    });
  });

  describe("Slash Command Handlers", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(findCreatorByTelegram).mockResolvedValue(mockCreator);
    });

    it("should handle /help command", async () => {
      const response = await handleMessage({
        platform: "telegram",
        platformUserId: "12345",
        displayName: "TestCreator",
        text: "/help",
      });

      expect(response.text).toContain("Welcome back");
      expect(response.text).toContain("/scan");
      expect(response.text).toContain("/deals");
      expect(response.text).toContain("/wallet");
      expect(response.text).toContain("👋"); // Check for emojis
      expect(response.parseMode).toBe("Markdown");
    });

    it("should handle /start command", async () => {
      const response = await handleMessage({
        platform: "telegram",
        platformUserId: "12345",
        displayName: "TestCreator",
        text: "/start",
      });

      expect(response.text).toContain("Welcome back");
      expect(response.text).toContain("Quick Commands");
    });

    it("should handle /calendar command", async () => {
      vi.mocked(getCalendarView).mockResolvedValue({
        overdue: [
          { title: "Invoice #123 - OldBrand", date: "2026-03-15", type: "invoice" },
        ],
        upcoming: [
          { title: "Follow-up call - FitnessBrand", date: "2026-03-25", type: "followup" },
        ],
      });

      const response = await handleMessage({
        platform: "telegram",
        platformUserId: "12345",
        displayName: "TestCreator",
        text: "/calendar",
      });

      expect(response.text).toContain("Upcoming Deadlines");
      expect(response.text).toContain("Invoice #123");
      expect(response.text).toContain("overdue");
    });

    it("should handle /finances command", async () => {
      vi.mocked(generateFinancialSnapshot).mockResolvedValue({
        income_last_30_days: 5000,
        expenses_last_30_days: 50,
        net_last_30_days: 4950,
        pipeline_value: 10000,
        pipeline_count: 5,
        income_by_source: { brand_deals: 4500, sponsorships: 500 },
        expense_by_category: { agent_spend: 50 },
      });

      const response = await handleMessage({
        platform: "telegram",
        platformUserId: "12345",
        displayName: "TestCreator",
        text: "/finances",
      });

      expect(response.text).toContain("Financial Snapshot formatted");
      expect(response.parseMode).toBe("Markdown");
    });

    it("should handle /content command", async () => {
      vi.mocked(generateContentStrategy).mockResolvedValue({
        this_week: ["Tech review video (YouTube)", "Instagram Reel"],
        next_week: ["Podcast episode", "TikTok series"],
        recommended_topics: ["AI tools", "Productivity"],
        platform_priorities: ["YouTube", "Instagram"],
      });

      const response = await handleMessage({
        platform: "telegram",
        platformUserId: "12345",
        displayName: "TestCreator",
        text: "/content",
      });

      expect(response.text).toContain("Content Strategy formatted");
      expect(response.parseMode).toBe("Markdown");
    });

    it("should handle empty calendar gracefully", async () => {
      vi.mocked(getCalendarView).mockResolvedValue({
        overdue: [],
        upcoming: [],
      });

      const response = await handleMessage({
        platform: "telegram",
        platformUserId: "12345",
        displayName: "TestCreator",
        text: "/calendar",
      });

      expect(response.text).toContain("No upcoming deadlines");
      expect(response.text).toContain("calendar is clear");
    });
  });

  describe("Improved User Experience", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(findCreatorByTelegram).mockResolvedValue(mockCreator);
    });

    it("should include emojis in help text", async () => {
      const response = await handleMessage({
        platform: "telegram",
        platformUserId: "12345",
        displayName: "TestCreator",
        text: "/help",
      });

      expect(response.text).toMatch(/👋|💼|📊|📅|💰|👛|📝|☀️/);
    });

    it("should support both slash and text commands for calendar", async () => {
      vi.mocked(getCalendarView).mockResolvedValue({
        overdue: [],
        upcoming: [],
      });

      const slashResponse = await handleMessage({
        platform: "telegram",
        platformUserId: "12345",
        displayName: "TestCreator",
        text: "/calendar",
      });

      const textResponse = await handleMessage({
        platform: "telegram",
        platformUserId: "12345",
        displayName: "TestCreator",
        text: "calendar",
      });

      expect(slashResponse.text).toContain("Upcoming Deadlines");
      expect(textResponse.text).toContain("Upcoming Deadlines");
    });

    it("should handle new user onboarding with improved message", async () => {
      const { ensureCreatorWalletProvisioning } = await import(
        "../../../src/wallet/provisioning.js"
      );

      vi.mocked(findCreatorByTelegram).mockResolvedValue(null);
      vi.mocked(createCreator).mockResolvedValue(mockCreator);
      vi.mocked(ensureCreatorWalletProvisioning).mockResolvedValue();

      const response = await handleMessage({
        platform: "telegram",
        platformUserId: "new-user-12345",
        displayName: "NewCreator",
        text: "Hello",
      });

      expect(response.text).toContain("Hey NewCreator");
      expect(response.text).toContain("Indyfren");
      expect(response.text).toContain("wallet");
      expect(response.text).toContain("👋"); // Emoji in welcome
      expect(response.parseMode).toBe("Markdown");
    });
  });
});
