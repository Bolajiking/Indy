import pino from "#logger";
import { scanForBrandDeals } from "../agent/skills/brand-deal-scanner.js";
import {
  getCreatorById,
  listCreatorsForMorningScans,
} from "../db/queries/creators.js";
import { getConnectionsForCreator } from "../db/queries/platform-connections.js";
import { runForCreators } from "./run-for-creators.js";

const log = pino({ name: "jobs:morning-scan" });

export async function runMorningScan(creatorId?: string): Promise<void> {
  await runForCreators(
    creatorId,
    listCreatorsForMorningScans,
    scanSingleCreator,
    log,
    "Morning scan failed",
  );
}

async function scanSingleCreator(creatorId: string): Promise<void> {
  const creator = await getCreatorById(creatorId);
  if (!creator?.niche) {
    log.info(
      { creatorId },
      "Skipping morning scan because creator niche is missing",
    );
    return;
  }

  const connections = await getConnectionsForCreator(creatorId);
  const platforms = connections.map((connection) => connection.platform);

  await scanForBrandDeals(creatorId, creator.niche, platforms);
}
