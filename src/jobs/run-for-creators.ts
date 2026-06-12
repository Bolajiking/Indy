import type pino from "pino";

/**
 * Shared fan-out for scheduled jobs: run for one creator when an id is given
 * (errors propagate to the caller), otherwise run for every listed creator,
 * logging per-creator failures without aborting the batch.
 */
export async function runForCreators(
  creatorId: string | undefined,
  listCreators: () => Promise<Array<{ id: string }>>,
  runSingle: (creatorId: string) => Promise<void>,
  log: pino.Logger,
  failureMessage: string,
): Promise<void> {
  if (creatorId) {
    await runSingle(creatorId);
    return;
  }

  const creators = await listCreators();
  for (const creator of creators) {
    try {
      await runSingle(creator.id);
    } catch (error) {
      log.error({ creatorId: creator.id, error }, failureMessage);
    }
  }
}
