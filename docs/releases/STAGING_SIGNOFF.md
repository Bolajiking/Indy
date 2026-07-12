# Staging Launch Sign-off

Status: **NOT SIGNED — public beta remains blocked**

## Candidate

- Branch: `codex/public-launch-readiness`
- Candidate commit: record the immutable SHA after Task 17 configuration lands
- Backend deployment ID: not recorded
- Dashboard deployment ID/URL: not recorded
- Migration ledger: not verified against staging
- Vercel CLI: `55.0.0` installed locally on 2026-07-11
- Railway CLI: `5.26.0` installed locally on 2026-07-11

## Current blockers

- `vercel whoami` reports that the configured token is invalid; the repository is not linked and `vercel env pull` cannot run.
- `railway whoami` reports `Unauthorized`; the project is not linked and staging deployment credentials are not available in this workspace.
- No protected staging Supabase, Redis, Privy, Composio, Google OAuth, Telegram, WhatsApp, or funded Tempo test creator has been provided and verified.
- The staging backup/restore exercise has no evidence record.
- Owner approval is still required for the public license, legal/policy copy, public support email, and GA payment scope.

## Required evidence

The release commander must attach redacted UTC output for:

```bash
DATABASE_URL="$STAGING_DATABASE_URL" npm run db:migrate:check
DATABASE_URL="$STAGING_DATABASE_URL" npm run db:migrate
npm run smoke:preflight
npm run smoke:health
npm run smoke:auth
npm run test:mpp
npm run smoke:messaging
npm run smoke:oauth
npm run test:e2e
```

Also record the commit SHA, Railway and Vercel deployment IDs, applied migration versions/checksums, provider environment identifiers, queue/worker readiness, rollback test, webhook replay result, approval-expiry result, Redis interruption result, provider-429 result, and backup/restore aggregate row-count comparison. Do not include tokens, raw receipts, message bodies, emails, phone numbers, or creator/wallet identifiers.

## Approval

Sign-off requires named release commander, security reviewer, database operator, product/legal owner, and UTC approval timestamps. An empty or partially completed section is a failed gate, not provisional approval.
