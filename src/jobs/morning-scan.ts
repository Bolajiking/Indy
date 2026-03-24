import pino from "pino";
import { scanForBrandDeals } from "../agent/skills/brand-deal-scanner.js";
import {
  getCreatorById,
  listCreatorsForMorningScans,
} from "../db/queries/creators.js";
import { getConnectionsForCreator } from "../db/queries/platform-connections.js";

const log = pino({ name: "jobs:morning-scan" });

export async function runMorningScan(creatorId?: string): Promise<void> {
  if (creatorId) {
    await scanSingleCreator(creatorId);
    return;
  }

  const creators = await listCreatorsForMorningScans();
  for (const creator of creators) {
    try {
      await scanSingleCreator(creator.id);
    } catch (error) {
      log.error({ creatorId: creator.id, error }, "Morning scan failed");
    }
  }
}

async function scanSingleCreator(creatorId: string): Promise<void> {
  const creator = await getCreatorById(creatorId);
  if (!creator?.niche) {
    log.info({ creatorId }, "Skipping morning scan because creator niche is missing");
    return;
  }

  const connections = await getConnectionsForCreator(creatorId);
  const platforms = connections.map((connection) => connection.platform);

  await scanForBrandDeals(creatorId, creator.niche, platforms);
}
