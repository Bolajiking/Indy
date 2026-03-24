import pino from "pino";
import { generateMorningBrief } from "../agent/skills/morning-brief.js";
import { formatMorningBrief } from "../bot/formatters.js";
import { sendMessageToCreator } from "../bot/telegram.js";
import { sendWhatsAppMessage } from "../bot/whatsapp.js";
import {
  getCreatorById,
  listCreatorsForMorningBriefs,
} from "../db/queries/creators.js";

const log = pino({ name: "jobs:morning-brief" });

export async function runMorningBrief(creatorId?: string): Promise<void> {
  if (creatorId) {
    await briefSingleCreator(creatorId);
    return;
  }

  const creators = await listCreatorsForMorningBriefs();
  for (const creator of creators) {
    try {
      await briefSingleCreator(creator.id);
    } catch (error) {
      log.error({ creatorId: creator.id, error }, "Morning brief failed");
    }
  }
}

async function briefSingleCreator(creatorId: string): Promise<void> {
  const creator = await getCreatorById(creatorId);
  if (!creator) {
    return;
  }

  const brief = await generateMorningBrief(creatorId);
  const response = {
    text: formatMorningBrief(brief),
    parseMode: "Markdown" as const,
  };

  if (creator.telegram_chat_id) {
    await sendMessageToCreator(creator.telegram_chat_id, response);
    log.info({ creatorId, platform: "telegram" }, "Morning brief sent");
  }

  if (creator.whatsapp_phone) {
    await sendWhatsAppMessage(creator.whatsapp_phone, response);
    log.info({ creatorId, platform: "whatsapp" }, "Morning brief sent");
  }
}
