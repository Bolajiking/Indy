# Deployment Runbook

Owner: release commander. Database changes require a database operator. Production promotion requires a second operator to verify smoke results.

The current GitHub workflow deploys a push to `main`; only a release commander with protected-branch merge rights may trigger it. Required status checks and review must be enforced in repository settings. Manual commands are break-glass operations for the same role, not a way to bypass CI.

## Prepare and deploy

```bash
export RELEASE_SHA="$(git rev-parse HEAD)"
npm ci
npm ci --prefix dashboard
npm run verify
npm run smoke:preflight
DATABASE_URL="$STAGING_DATABASE_URL" npm run db:migrate:check
DATABASE_URL="$STAGING_DATABASE_URL" npm run db:migrate
railway up --service backend --detach
vercel deploy dashboard --prod --yes
```

Migrations run before application promotion and must be backward compatible with the prior release. Never seed production. Record the release SHA, migration ledger, Railway deployment ID, Vercel deployment URL, operator, and UTC timestamps in the release record.

## Verify

```bash
export SMOKE_API_URL="$API_BASE_URL"
export SMOKE_DASHBOARD_URL="$DASHBOARD_BASE_URL"
export SMOKE_REQUIRE_DASHBOARD=true
node --import tsx scripts/smoke-health.ts
npm run smoke:auth
npm run test:mpp
```

Verify `/health` stays 200, `/health/ready` is 200 with database, rate-limit Redis, queue, and worker checks green, dashboard sign-in works, the dashboard proxy preserves `X-Request-Id`, and a funded sandbox creator completes the MPP smoke. Verify Telegram/WhatsApp only when that transport is enabled.

Stop promotion and use [ROLLBACK.md](./ROLLBACK.md) for elevated 5xx rates, readiness failure, cross-tenant access, duplicate writes, failed auth, queue growth without consumption, or payment/wallet inconsistencies.
