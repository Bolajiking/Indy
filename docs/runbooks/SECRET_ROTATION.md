# Secret Rotation Runbook

Owner: security lead; a release commander performs deployment. Never print or paste secret values into tickets, chat, logs, or command history.

## Dry run

1. Inventory the affected secret and every consumer/environment.
2. Confirm dual-key support. Platform credential encryption uses current and previous key versions; single-value provider secrets require a coordinated cutover.
3. Run `npm run smoke:preflight` with the current configuration and capture redacted output.

## Execute

Generate secrets with an approved password manager or `openssl rand -base64 32`. Add the new value to Railway/Vercel/Supabase/Privy/provider controls, deploy consumers, verify, then revoke the old value. For platform encryption keys:

```bash
PLATFORM_ENCRYPTION_KEY_CURRENT="$NEW_KEY" \
PLATFORM_ENCRYPTION_KEY_VERSION="$NEW_VERSION" \
PLATFORM_ENCRYPTION_KEY_PREVIOUS="$OLD_KEY" \
PLATFORM_ENCRYPTION_KEY_PREVIOUS_VERSION="$OLD_VERSION" \
npm run migrate:platform-secrets
```

After migration and verification, remove the previous key in a second deployment. For webhook secrets, update the application and provider registration in one maintenance window. For database/service keys, rotate at the issuer and redeploy every consumer before revocation.

## Verify and recover

Run preflight, health, auth, OAuth connection, webhook signature, and affected provider smokes. If verification fails, restore the prior value from the secret manager, redeploy, and verify before investigating. Evidence records contain secret name/version, issuer audit event, deployment IDs, operator, UTC timestamps, and redacted smoke results—never the value.
