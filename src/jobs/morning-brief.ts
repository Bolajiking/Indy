import pino from "pino";
import { generateMorningBrief } from "../agent/skills/morning-brief.js";
import { formatMorningBrief } from "../bot/formatters.js";
import {
  getCreatorById,
  listCreatorsForMorningBriefs,
} from "../db/queries/creators.js";
import { sendCreatorMessageToChannels } from "./creator-message.js";
import { runForCreators } from "./run-for-creators.js";

const log = pino({ name: "jobs:morning-brief" });

export async function runMorningBrief(creatorId?: string): Promise<void> {
  await runForCreators(
    creatorId,
    listCreatorsForMorningBriefs,
    briefSingleCreator,
    log,
    "Morning brief failed",
  );
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

  await sendCreatorMessageToChannels(
    creatorId,
    creator,
    response,
    log,
    "Morning brief sent",
  );
}
