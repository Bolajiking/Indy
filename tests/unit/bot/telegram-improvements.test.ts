import { describe, it, expect, vi, beforeEach } from "vitest";
import { splitMessage } from "../../../src/bot/telegram.js";
import { handleMessage } from "../../../src/bot/handler.js";
import {
  findCreatorByTelegram,
  createCreator,
} from "../../../src/db/queries/creators.js";
import { processCreatorMessage } from "../../../src/agent/conversation.js";

vi.mock("../../../src/db/queries/creators.js");
vi.mock("../../../src/db/queries/messages.js");
vi.mock("../../../src/wallet/provisioning.js");
vi.mock("../../../src/agent/orchestrator.js");
vi.mock("../../../src/agent/conversation.js", () => ({
  processCreatorMessage: vi.fn().mockResolvedValue({
    text: "Here's what I found.",
    requiresApproval: false,
  }),
}));
vi.mock("../../../src/bot/formatters.js", () => ({}));

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
      vi.mocked(processCreatorMessage).mockResolvedValue({
        text: "*Upcoming Deadlines*\n\n🔴 overdue: Invoice #123 - OldBrand (2026-03-15)\n📅 Follow-up call - FitnessBrand (2026-03-25)",
        requiresApproval: false,
      });

      const response = await handleMessage({
        platform: "telegram",
        platformUserId: "12345",
        displayName: "TestCreator",
        text: "/calendar",
      });

      expect(processCreatorMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          text: "show my upcoming deadlines and calendar",
        }),
      );
      expect(response.text).toContain("Upcoming Deadlines");
      expect(response.text).toContain("Invoice #123");
      expect(response.text).toContain("overdue");
    });

    it("should handle /finances command", async () => {
      vi.mocked(processCreatorMessage).mockResolvedValue({
        text: "*Financial Snapshot*\nNet: $4,950",
        requiresApproval: false,
      });

      const response = await handleMessage({
        platform: "telegram",
        platformUserId: "12345",
        displayName: "TestCreator",
        text: "/finances",
      });

      expect(processCreatorMessage).toHaveBeenCalledWith(
        expect.objectContaining({ text: "give me my financial snapshot" }),
      );
      expect(response.text).toContain("Financial Snapshot");
      expect(response.parseMode).toBe("Markdown");
    });

    it("should handle /content command", async () => {
      vi.mocked(processCreatorMessage).mockResolvedValue({
        text: "*Content Strategy*\nThis week: Tech review video",
        requiresApproval: false,
      });

      const response = await handleMessage({
        platform: "telegram",
        platformUserId: "12345",
        displayName: "TestCreator",
        text: "/content",
      });

      expect(processCreatorMessage).toHaveBeenCalledWith(
        expect.objectContaining({ text: "generate my content strategy" }),
      );
      expect(response.text).toContain("Content Strategy");
      expect(response.parseMode).toBe("Markdown");
    });

    it("should handle empty calendar gracefully", async () => {
      vi.mocked(processCreatorMessage).mockResolvedValue({
        text: "*Upcoming Deadlines*\n\nNo upcoming deadlines — your calendar is clear! 🎉",
        requiresApproval: false,
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
      vi.mocked(processCreatorMessage).mockResolvedValue({
        text: "*Upcoming Deadlines*\n\nAll clear.",
        requiresApproval: false,
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
      const { ensureCreatorWalletProvisioning } =
        await import("../../../src/wallet/provisioning.js");

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
