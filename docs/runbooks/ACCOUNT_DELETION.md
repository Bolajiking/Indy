# Account Deletion Recovery Runbook

Owner: privacy operations; backend on-call executes recovery. Authenticate the requester through the application flow, never by emailed creator ID.

## Inspect safely

Use the opaque deletion receipt through the public status endpoint. Logs/evidence may include request ID, receipt hash, lifecycle state, and timestamps, but not the raw receipt, Privy token, message content, or deleted identifiers.

States normally progress `requested` → `revoking-connections` → `deleting` → `completed`. Only `retryable-failure` is operator-retryable.

## Recover

```bash
npm run jobs:retry-failed -- --dry-run --type account-deletion --max 25
npm run jobs:retry-failed -- --type account-deletion --max 25
```

The creator row is deleted last. Native/Composio connections and the Privy user are revoked first. The workflow is idempotent; do not manually delete partial rows or recreate a deleted creator.

Verify the receipt reaches `completed`, creator-scoped rows are absent, connections are revoked, and no retryable job remains. Expected residual disclosures are public blockchain history and provider-archived/disassociated wallet records described in `docs/account-deletion.md`.

There is no rollback after deletion completes. For a stuck or ambiguous external revocation, stop retries, preserve redacted evidence, and escalate as a privacy incident.
