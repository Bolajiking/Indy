import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/agent/skills/morning-brief.js", () => ({
  generateMorningBrief: vi.fn(),
}));

vi.mock("../../../src/db/queries/creators.js", () => ({
  getCreatorById: vi.fn(),
  listCreatorsForMorningBriefs: vi.fn(),
}));

vi.mock("../../../src/bot/telegram.js", () => ({
  sendMessageToCreator: vi.fn(),
}));

vi.mock("../../../src/bot/whatsapp.js", () => ({
  sendWhatsAppMessage: vi.fn(),
}));

import { generateMorningBrief } from "../../../src/agent/skills/morning-brief.js";
import {
  getCreatorById,
  listCreatorsForMorningBriefs,
} from "../../../src/db/queries/creators.js";
import { sendMessageToCreator } from "../../../src/bot/telegram.js";
import { sendWhatsAppMessage } from "../../../src/bot/whatsapp.js";
import { runMorningBrief } from "../../../src/jobs/morning-brief.js";

describe("runMorningBrief", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateMorningBrief).mockResolvedValue({
      greeting: "Good morning",
      items: [
        {
          emoji: "💼",
          title: "Deal update",
          detail: "Acme looks promising.",
          actionPrompt: "Reply to move it forward.",
        },
      ],
      closingNote: "Let's make money today.",
    });
  });

  it("sends a formatted brief to a creator's Telegram chat", async () => {
    vi.mocked(getCreatorById).mockResolvedValue({
      id: "creator-1",
      telegram_chat_id: "12345",
      whatsapp_phone: null,
    } as never);

    await runMorningBrief("creator-1");

    expect(generateMorningBrief).toHaveBeenCalledWith("creator-1");
    expect(sendMessageToCreator).toHaveBeenCalledWith(
      "12345",
      expect.objectContaining({
        parseMode: "Markdown",
        text: expect.stringContaining("Good morning"),
      })
    );
    expect(sendWhatsAppMessage).not.toHaveBeenCalled();
  });

  it("broadcasts briefs to all creators with connected channels", async () => {
    vi.mocked(listCreatorsForMorningBriefs).mockResolvedValue([
      { id: "creator-1", telegram_chat_id: "12345", whatsapp_phone: null },
      { id: "creator-2", telegram_chat_id: null, whatsapp_phone: "2348000" },
      { id: "creator-3", telegram_chat_id: null, whatsapp_phone: null },
    ] as never);
    vi.mocked(getCreatorById).mockImplementation(async (creatorId: string) => {
      if (creatorId === "creator-1") {
        return {
          id: creatorId,
          telegram_chat_id: "12345",
          whatsapp_phone: null,
        } as never;
      }

      if (creatorId === "creator-2") {
        return {
          id: creatorId,
          telegram_chat_id: null,
          whatsapp_phone: "2348000",
        } as never;
      }

      return {
        id: creatorId,
        telegram_chat_id: null,
        whatsapp_phone: null,
      } as never;
    });

    await runMorningBrief();

    expect(generateMorningBrief).toHaveBeenCalledTimes(3);
    expect(sendMessageToCreator).toHaveBeenCalledTimes(1);
    expect(sendWhatsAppMessage).toHaveBeenCalledTimes(1);
    expect(sendWhatsAppMessage).toHaveBeenCalledWith(
      "2348000",
      expect.objectContaining({
        parseMode: "Markdown",
        text: expect.stringContaining("Let's make money today."),
      })
    );
  });
});
