-- Every approval must have a durable deadline. Existing pending rows are set to
-- their original creation time so they cannot be approved after this upgrade.
UPDATE agent_actions
SET expires_at = COALESCE(approved_at, executed_at, created_at)
WHERE expires_at IS NULL;

ALTER TABLE agent_actions
  ALTER COLUMN expires_at SET NOT NULL;
