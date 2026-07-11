import type { Logger } from "#logger";
import type { OutgoingMessage } from "../bot/messages.js";
import { sendMessageToCreator } from "../bot/telegram.js";
import { sendWhatsAppMessage } from "../bot/whatsapp.js";

interface CreatorMessageChannels {
  telegram_chat_id?: string | null;
  whatsapp_phone?: string | null;
}

export async function sendCreatorMessageToChannels(
  creatorId: string,
  creator: CreatorMessageChannels,
  message: OutgoingMessage,
  log: Logger,
  successMessage: string,
): Promise<void> {
  if (creator.telegram_chat_id) {
    await sendMessageToCreator(creator.telegram_chat_id, message);
    log.info({ creatorId, platform: "telegram" }, successMessage);
  }

  if (creator.whatsapp_phone) {
    await sendWhatsAppMessage(creator.whatsapp_phone, message);
    log.info({ creatorId, platform: "whatsapp" }, successMessage);
  }
}
