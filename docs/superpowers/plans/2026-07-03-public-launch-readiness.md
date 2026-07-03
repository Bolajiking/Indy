# Indyfren Public Launch Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Indyfren safe and supportable for a public sandbox beta, then establish explicit technical and operational gates for real-value production GA.

**Architecture:** Keep the existing Hono, Next.js, Supabase, Privy, Composio, and BullMQ stack. Harden its boundaries with production configuration validation, Redis-backed abuse controls, verified/idempotent queued webhooks, versioned secret encryption, user lifecycle APIs, observability, and staged release gates. Sandbox beta remains Tempo testnet-only; real-value payments are a separately approved GA workstream.

**Tech Stack:** TypeScript 5, Node.js 22, Hono, Next.js 15, React 19, Supabase/PostgreSQL, Redis/BullMQ, Privy, Composio, Tempo/MPP, Vitest, Playwright, GitHub Actions, Railway, Vercel.

---

## Source Design and Execution Rules

- Design: `docs/superpowers/specs/2026-07-03-public-launch-readiness-design.md`
- Work in the order shown. A later release gate may not be declared green while an
  earlier gate is red.
- Use TDD for behavior changes: failing test, focused implementation, passing test,
  related suite, then commit.
- Do not put real credentials in fixtures, screenshots, logs, commits, or CI output.
- Do not enable real-value payments as part of the sandbox-beta tasks.
- Keep commits scoped to one task so security changes can be reviewed or reverted
  independently.

## Workstream Dependency Map

```text
Engineering baseline
  -> production configuration + migrations
  -> trust boundaries (rate limits, webhooks, approvals, encryption, agent safety)
  -> user lifecycle + product completion
  -> observability + runtime operations
  -> staging E2E and live smokes
  -> public sandbox beta
  -> separately approved real-value GA
```

## Planned File Map

### Engineering and configuration

- Modify `package.json`, `package-lock.json`, `dashboard/package.json`, and
  `dashboard/package-lock.json` for supported dependency versions, Node pinning, and
  verification scripts.
- Modify `.github/workflows/ci.yml` to enforce the complete gate set.
- Modify `src/config/env.ts` and add `src/config/validate-production-env.ts` for
  fail-closed production configuration.
- Modify `scripts/preflight.ts` so it evaluates the same contract as application
  startup.

### Persistence and security

- Create `src/db/migrations/` and `scripts/migrate-db.ts` for ordered migrations.
- Modify `src/db/schema.sql` only as the clean-install snapshot generated from the
  migration state.
- Add `src/db/queries/webhook-events.ts` and `src/db/queries/account-lifecycle.ts`.
- Modify `src/security/secrets.ts` and platform-connection queries for versioned key
  rotation.

### API and messaging boundary

- Split rate limiting from `src/api/server.ts` into
  `src/api/middleware/rate-limit.ts` and `src/api/rate-limit-store.ts`.
- Modify `src/api/routes/webhooks.ts`, `src/bot/telegram.ts`, `src/bot/whatsapp.ts`,
  and `src/index.ts` for authenticated, single-mode, queued ingress.
- Add `src/jobs/webhook-delivery.ts` and extend `src/jobs/queue.ts`.
- Modify approval queries and execution for expiry and identity binding.

### Product and operations

- Add account export/deletion API routes, queue jobs, and dashboard controls.
- Add deal create/edit/detail/archive UI and API client methods.
- Add public legal/support routes and footer links.
- Add request IDs, redaction, metrics/error reporting adapters, graceful shutdown,
  and operational runbooks.
- Add Playwright E2E, accessibility checks, staging smoke orchestration, and release
  checklists.

---

## Phase 0: Restore a Trustworthy Engineering Baseline

### Task 1: Make the existing CI contract green

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `dashboard/package.json`
- Modify: `dashboard/package-lock.json`
- Modify: `.github/workflows/ci.yml`
- Modify: the 14 files currently reported by Prettier
- Modify: `README.md`
- Modify: `docs/COMPLETION_STATUS.md`
- Modify: `docs/TEST_RESULTS.md`

- [ ] **Step 1: Capture the failing baseline in the task notes**

Run:

```bash
npm test
npm run build
npm run dashboard:build
npx prettier --check "src/**/*.ts" "tests/**/*.ts"
npm audit --audit-level=moderate
npm audit --audit-level=high --prefix dashboard
```

Expected: tests and builds pass; formatting and both audits fail. Record exact advisory
dependency paths before changing lockfiles.

- [ ] **Step 2: Pin the runtime used by local, CI, Docker, Railway, and Vercel builds**

Add this to both package manifests:

```json
"engines": {
  "node": "22.x"
}
```

Keep the Docker and GitHub Actions runtime on Node 22 for this launch. Runtime upgrades
belong in a separate compatibility change.

- [ ] **Step 3: Apply non-breaking dependency remediations**

Run:

```bash
npm audit fix
npm audit fix --prefix dashboard
```

Review every manifest and lockfile change. Do not use `--force`. If `ws` remains through
Privy/viem/MPP, document its reachable runtime surface and either upgrade the owning
package or add a time-bounded risk exception with an owner and removal condition.

- [ ] **Step 4: Format only the reported files**

Run:

```bash
npx prettier --write "src/**/*.ts" "tests/**/*.ts"
```

Expected: no semantic diff beyond formatting.

- [ ] **Step 5: Add one canonical verification script**

Add to root `package.json`:

```json
"verify": "npm test && npm run build && npm run dashboard:build && npx prettier --check 'src/**/*.ts' 'tests/**/*.ts' && npm audit --audit-level=moderate && npm audit --audit-level=high --prefix dashboard"
```

Make CI call the same commands rather than documenting a different standard. Make
both deployment jobs depend on the security job as well as tests/builds; a failed
audit must prevent deployment rather than merely display a red parallel check.

- [ ] **Step 6: Re-run all baseline gates**

Run:

```bash
npm run verify
git diff --check
```

Expected: all commands pass, or a narrowly documented transitive advisory exception is
implemented without lowering unrelated audit thresholds.

- [ ] **Step 7: Correct stale status claims**

Update test counts, dependency status, sandbox wording, and live-smoke status. Remove
claims that the application is deployment-ready until the staging gate passes.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json dashboard/package.json dashboard/package-lock.json .github/workflows/ci.yml README.md docs/COMPLETION_STATUS.md docs/TEST_RESULTS.md src tests
git commit -m "chore: restore launch verification gates"
```

---

## Phase 1: Production Configuration and Durable Schema

### Task 2: Fail closed on unsafe production configuration

**Files:**

- Create: `src/config/validate-production-env.ts`
- Modify: `src/config/env.ts`
- Modify: `src/index.ts`
- Modify: `scripts/preflight.ts`
- Modify: `.env.example`
- Test: `tests/unit/config/production-env.test.ts`

- [ ] **Step 1: Write failing tests for the production contract**

Cover at least:

```ts
expect(() => validateProductionEnv(env({ MESSAGING_LINK_SECRET: "" }))).toThrow(
  /MESSAGING_LINK_SECRET/,
);
expect(() =>
  validateProductionEnv(env({ WHATSAPP_VERIFY_TOKEN: "indyfren-verify" })),
).toThrow(/WHATSAPP_VERIFY_TOKEN/);
expect(() =>
  validateProductionEnv(
    env({ TELEGRAM_MODE: "webhook", TELEGRAM_WEBHOOK_SECRET: "" }),
  ),
).toThrow(/TELEGRAM_WEBHOOK_SECRET/);
expect(() =>
  validateProductionEnv(env({ PLATFORM_ENCRYPTION_KEY_V1: "" })),
).toThrow(/PLATFORM_ENCRYPTION_KEY_V1/);
```

- [ ] **Step 2: Verify the new tests fail**

Run:

```bash
npm test -- tests/unit/config/production-env.test.ts
```

Expected: FAIL because the validator and new environment fields do not exist.

- [ ] **Step 3: Add explicit environment fields**

Add schemas for:

```ts
TELEGRAM_MODE: z.enum(["disabled", "polling", "webhook"]),
TELEGRAM_WEBHOOK_SECRET: z.string(),
TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).max(2),
PLATFORM_ENCRYPTION_KEY_VERSION: z.string(),
PLATFORM_ENCRYPTION_KEY_V1: z.string(),
PLATFORM_ENCRYPTION_KEY_PREVIOUS: z.string(),
ERROR_REPORTING_DSN: z.string(),
PUBLIC_SUPPORT_EMAIL: z.string().email(),
```

Do not give production secrets usable defaults.

- [ ] **Step 4: Implement one shared validator**

The validator returns all missing/unsafe fields in one error. `src/index.ts` calls it
before binding a port. `scripts/preflight.ts` converts the same findings into its
human-readable checklist.

- [ ] **Step 5: Add provider-conditional rules**

Require Google credentials only when YouTube OAuth is enabled, Telegram secrets only
for Telegram webhook mode, WhatsApp secrets only when WhatsApp is enabled, and Redis
when jobs or distributed rate limiting are enabled.

- [ ] **Step 6: Run focused and existing config tests**

```bash
npm test -- tests/unit/config/production-env.test.ts tests/unit/config/constants.test.ts tests/unit/ops/smoke-health.test.ts
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/config src/index.ts scripts/preflight.ts .env.example tests/unit/config
git commit -m "feat: validate production configuration at startup"
```

### Task 3: Introduce ordered database migrations

**Files:**

- Create: `src/db/migrations/0001_baseline.sql`
- Create: `src/db/migrations/0002_public_launch_readiness.sql`
- Create: `scripts/migrate-db.ts`
- Modify: `src/db/schema.sql`
- Modify: `package.json`
- Test: `tests/unit/db/migrations.test.ts`

- [ ] **Step 1: Write a failing migration-order test**

Assert that migration filenames are unique, lexically ordered, non-empty, and that
the launch migration contains the expected tables/columns.

- [ ] **Step 2: Verify failure**

```bash
npm test -- tests/unit/db/migrations.test.ts
```

Expected: FAIL because `src/db/migrations` does not exist.

- [ ] **Step 3: Add the migration ledger and runner**

The runner must:

```ts
await client.query("BEGIN");
await client.query(migrationSql);
await client.query(
  "INSERT INTO schema_migrations(version, checksum) VALUES ($1, $2)",
  [version, checksum],
);
await client.query("COMMIT");
```

It must reject checksum drift and roll back failed migrations.

For an existing Supabase database, add a `--adopt-baseline` mode that first verifies
the required baseline tables, columns, indexes, and policies. It may record migration
`0001` as applied only when the live schema matches; it must not blindly mark an
unknown schema current. Exercise both a clean database and an adopted database in
tests.

- [ ] **Step 4: Add launch-readiness schema**

Create:

```sql
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider, provider_event_id)
);
```

Also add `agent_actions.expires_at`, `platform_connections.key_version`, and creator
account lifecycle fields (`account_status`, `deletion_requested_at`). Apply RLS and
service-role-only policies consistently with existing tables.

- [ ] **Step 5: Add scripts**

```json
"db:migrate": "tsx scripts/migrate-db.ts",
"db:migrate:check": "tsx scripts/migrate-db.ts --check"
```

- [ ] **Step 6: Test clean install and upgrade paths against a disposable database**

Run the baseline and launch migrations twice. Expected: the second run performs no
schema changes and reports all checksums current.

- [ ] **Step 7: Commit**

```bash
git add src/db scripts/migrate-db.ts package.json package-lock.json tests/unit/db
git commit -m "feat: add ordered database migrations"
```

---

## Phase 2: Public Trust Boundaries

### Task 4: Replace process-local rate limiting with distributed policies

**Files:**

- Create: `src/api/rate-limit-store.ts`
- Create: `src/api/middleware/rate-limit.ts`
- Modify: `src/api/server.ts`
- Modify: `src/index.ts`
- Modify: `vercel.json`
- Modify: `package.json`
- Test: `tests/unit/api/rate-limit.test.ts`
- Test: `tests/unit/api/server.test.ts`

- [ ] **Step 1: Write failing policy tests**

Test anonymous-IP limits, authenticated creator limits, a stricter
`POST /api/agent/messages` policy, reset headers, Redis failures, and multiple server
instances sharing a store.

- [ ] **Step 2: Verify failure**

```bash
npm test -- tests/unit/api/rate-limit.test.ts tests/unit/api/server.test.ts
```

- [ ] **Step 3: Define a storage boundary**

```ts
export interface RateLimitStore {
  increment(
    key: string,
    windowMs: number,
  ): Promise<{ count: number; resetAt: number }>;
}
```

Provide an in-memory implementation for tests and a Redis implementation for
production. Add `ioredis` as a direct dependency rather than relying on BullMQ's
transitive dependency.

- [ ] **Step 4: Define route policies**

At minimum:

- health: generous anonymous limit;
- auth/register and OAuth start: conservative IP limit;
- authenticated reads: creator-level limit;
- agent message and report generation: strict creator-level limit;
- approvals and connected-app writes: strict creator-level limit.

Apply a coarse anonymous limiter before authentication and creator-specific policies
after `requireCreatorAuth`, so an authenticated user cannot escape creator quotas by
changing network addresses.

- [ ] **Step 5: Stop trusting arbitrary forwarding headers**

Use the socket address unless the request passed through the configured number of
trusted proxy hops. Add tests showing an attacker cannot rotate a spoofed
`x-forwarded-for` value to bypass limits.

Remove the wildcard `Access-Control-Allow-Origin` plus credentials headers from
`vercel.json`. Dashboard calls use the same-origin proxy; backend CORS continues to
allow only the validated dashboard origin.

- [ ] **Step 6: Run tests and build**

```bash
npm test -- tests/unit/api/rate-limit.test.ts tests/unit/api/server.test.ts
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add src/api src/index.ts package.json package-lock.json tests/unit/api
git commit -m "feat: enforce distributed API rate limits"
```

### Task 5: Authenticate provider webhooks and select one Telegram mode

**Files:**

- Modify: `src/config/env.ts`
- Modify: `src/index.ts`
- Modify: `src/api/routes/webhooks.ts`
- Modify: `src/bot/telegram.ts`
- Modify: `src/bot/whatsapp.ts`
- Modify: `.env.example`
- Test: `tests/unit/api/server.test.ts`
- Test: `tests/unit/bot/telegram-startup.test.ts`

- [ ] **Step 1: Write failing Telegram webhook authentication tests**

Require `X-Telegram-Bot-Api-Secret-Token` to match the configured secret in webhook
mode. Missing or incorrect values return `401` without invoking grammY.

- [ ] **Step 2: Write failing mode-selection tests**

Assert polling starts only in `polling` mode, webhook registration occurs only in
`webhook` mode, and neither starts in `disabled` mode.

- [ ] **Step 3: Verify failures**

```bash
npm test -- tests/unit/api/server.test.ts tests/unit/bot/telegram-startup.test.ts
```

- [ ] **Step 4: Implement fail-closed verification and mode selection**

Do not start long polling while a webhook is configured. Document the exact Telegram
`setWebhook` command including `secret_token`.

- [ ] **Step 5: Harden WhatsApp verification**

Remove the `indyfren-verify` production default, require the Meta app secret when
WhatsApp is enabled, and compare HMAC values with equal-length buffers and
`timingSafeEqual`.

- [ ] **Step 6: Run focused tests and preflight**

```bash
npm test -- tests/unit/api/server.test.ts tests/unit/bot/telegram-startup.test.ts tests/integration/bot-to-agent.test.ts
npm run smoke:preflight
```

Expected locally: tests pass; preflight may still report absent operator credentials,
but now names every required webhook-mode field.

- [ ] **Step 7: Commit**

```bash
git add src/config src/index.ts src/api/routes/webhooks.ts src/bot .env.example tests
git commit -m "feat: secure messaging webhook ingress"
```

### Task 6: Make webhook delivery idempotent and asynchronous

**Files:**

- Create: `src/db/queries/webhook-events.ts`
- Create: `src/jobs/webhook-delivery.ts`
- Modify: `src/jobs/queue.ts`
- Modify: `src/api/routes/webhooks.ts`
- Modify: `src/bot/whatsapp.ts`
- Test: `tests/unit/jobs/webhook-delivery.test.ts`
- Test: `tests/integration/webhook-idempotency.test.ts`

- [ ] **Step 1: Write failing event-ID parser tests**

Telegram uses `update_id`. WhatsApp uses each message's `id`; update the payload type
accordingly. Reject processable events without a stable provider ID.

- [ ] **Step 2: Write a failing duplicate-delivery integration test**

Submit the same signed event twice and assert:

```ts
expect(first.status).toBe(202);
expect(second.status).toBe(202);
expect(enqueuedJobsFor(eventId)).toHaveLength(1);
expect(handleMessage).toHaveBeenCalledTimes(1);
```

- [ ] **Step 3: Implement atomic event claiming**

Insert `(provider, provider_event_id)` before enqueueing. Treat a unique-conflict as an
already accepted event, not an error. Store only a hash and processing metadata in
Postgres; do not persist raw message content in `webhook_events`.

- [ ] **Step 4: Add the BullMQ worker**

Use deterministic job IDs, bounded exponential backoff, and terminal failure state.
Successful jobs set `processed_at`; exhausted jobs preserve a redacted error.

- [ ] **Step 5: Acknowledge before processing**

Routes verify, claim, enqueue, and return `202`. They no longer wait for an LLM call or
outbound provider send.

- [ ] **Step 6: Run tests**

```bash
npm test -- tests/unit/jobs/webhook-delivery.test.ts tests/integration/webhook-idempotency.test.ts tests/integration/bot-to-agent.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add src/db/queries/webhook-events.ts src/jobs src/api/routes/webhooks.ts src/bot/whatsapp.ts tests
git commit -m "feat: queue idempotent webhook processing"
```

### Task 7: Bind approvals and feedback to the authenticated messaging identity

**Files:**

- Modify: `src/bot/telegram.ts`
- Modify: `src/bot/approval.ts`
- Modify: `src/db/queries/agent-actions.ts`
- Modify: `src/agent/approval-execution.ts`
- Modify: `src/agent/loop.ts`
- Test: `tests/unit/bot/approval.test.ts`
- Test: `tests/unit/bot/telegram.test.ts`
- Test: `tests/unit/agent/orchestrator.test.ts`

- [ ] **Step 1: Write a failing cross-creator callback test**

A callback from Telegram user B referencing creator A's action must return an
authorization error and leave the action pending.

- [ ] **Step 2: Write failing expiry tests**

Pending approvals older than the configured window must not appear or execute.

- [ ] **Step 3: Verify failures**

```bash
npm test -- tests/unit/bot/approval.test.ts tests/unit/bot/telegram.test.ts
```

- [ ] **Step 4: Resolve the callback sender before using callback data**

Load the creator by `ctx.from.id`; compare its ID with the action's creator ID. Treat
callback payload IDs only as lookup hints, never authentication.

- [ ] **Step 5: Persist and enforce approval expiry**

Set `expires_at` when the action is created. Include `expires_at > now()` in the atomic
pending-to-approved update.

- [ ] **Step 6: Ensure every write path uses the atomic claim**

Dashboard and Telegram approvals must share the same `pending -> approved` guarded
update before external side effects.

- [ ] **Step 7: Run focused tests and the full suite**

```bash
npm test -- tests/unit/bot/approval.test.ts tests/unit/bot/telegram.test.ts tests/unit/api/agent.test.ts
npm test
```

- [ ] **Step 8: Commit**

```bash
git add src/bot src/db/queries/agent-actions.ts src/agent tests
git commit -m "fix: bind approvals to creator identities"
```

### Task 8: Add versioned platform-secret encryption

**Files:**

- Modify: `src/security/secrets.ts`
- Modify: `src/db/queries/platform-connections.ts`
- Modify: `src/security/platform-secret-migration.ts`
- Modify: `scripts/migrate-platform-secrets.ts`
- Test: `tests/unit/security/platform-secret-migration.test.ts`
- Test: `tests/unit/security/secrets.test.ts`

- [ ] **Step 1: Write failing key-version tests**

Cover current-key encryption, previous-key decryption, unknown versions, malformed
ciphertext, and rotation without plaintext exposure.

- [ ] **Step 2: Verify failure**

```bash
npm test -- tests/unit/security/secrets.test.ts tests/unit/security/platform-secret-migration.test.ts
```

- [ ] **Step 3: Replace derived key material**

Use an explicit 32-byte base64 key selected by version. New ciphertext format:

```text
v2:<key-version>:<iv-base64url>:<tag-base64url>:<ciphertext-base64url>
```

Keep v1 reads only during migration; do not write new v1 values.

- [ ] **Step 4: Add resumable rotation**

Rotate in bounded batches, update `key_version`, count successes/failures, and support
`--dry-run`. Never log decrypted tokens.

- [ ] **Step 5: Run tests and a dry run against staging data**

```bash
npm test -- tests/unit/security
npm run migrate:platform-secrets -- --dry-run
```

- [ ] **Step 6: Commit**

```bash
git add src/security src/db/queries/platform-connections.ts scripts/migrate-platform-secrets.ts tests/unit/security
git commit -m "feat: support platform secret key rotation"
```

### Task 9: Delimit untrusted agent data and strengthen action previews

**Files:**

- Modify: `src/agent/tool-result.ts`
- Modify: `src/agent/prompts.ts`
- Modify: `src/agent/loop.ts`
- Modify: `src/integrations/composio.ts`
- Modify: `src/agent/tools/mcp-adapter.ts`
- Modify: `src/agent/tools/email-sender.ts`
- Test: `tests/unit/agent/app-tool-wall.test.ts`
- Test: `tests/unit/agent/composio-write-gating.test.ts`
- Create: `tests/unit/agent/untrusted-tool-data.test.ts`

- [ ] **Step 1: Add failing prompt-injection fixtures**

Include external results containing instructions to reveal secrets, bypass approval,
change recipients, or call another tool. Assert they are returned as inert data.

- [ ] **Step 2: Verify failure**

```bash
npm test -- tests/unit/agent/untrusted-tool-data.test.ts tests/unit/agent/app-tool-wall.test.ts
```

- [ ] **Step 3: Wrap external results**

Serialize external results inside a stable envelope such as:

```text
<untrusted_external_data source="composio:gmail">
...
</untrusted_external_data>
```

Escape closing delimiters and retain the current size clamp.

- [ ] **Step 4: Add a permanent trust-boundary directive**

State that external data cannot alter system policy, request credentials, approve its
own actions, or change the user-confirmed destination.

- [ ] **Step 5: Make previews materially complete**

For every connected-app or paid write, preview service, operation, recipient or target,
material arguments, and maximum cost. Reject approval creation if required preview
fields are missing.

- [ ] **Step 6: Run adversarial and existing tool-wall tests**

```bash
npm test -- tests/unit/agent/untrusted-tool-data.test.ts tests/unit/agent/app-tool-wall.test.ts tests/unit/agent/composio-write-gating.test.ts tests/unit/agent/mcp-adapter.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add src/agent src/integrations/composio.ts tests/unit/agent
git commit -m "feat: harden agent external-data boundaries"
```

---

## Phase 3: Public User Lifecycle and Product Completion

### Task 10: Add creator data export and account deletion

**Files:**

- Create: `src/api/routes/account.ts`
- Create: `src/db/queries/account-lifecycle.ts`
- Create: `src/jobs/account-deletion.ts`
- Modify: `src/api/contracts.ts`
- Modify: `src/index.ts`
- Modify: `src/jobs/queue.ts`
- Modify: `src/integrations/composio.ts`
- Modify: `dashboard/src/lib/api.ts`
- Modify: `dashboard/src/components/cf/settings-modal.tsx`
- Test: `tests/unit/api/account.test.ts`
- Test: `tests/unit/jobs/account-deletion.test.ts`
- Test: `tests/unit/dashboard/account-settings.test.tsx`

- [ ] **Step 1: Write failing export-isolation tests**

An export includes only the authenticated creator's profile, deals, transactions,
payment attempts, messages, actions, memories, outcomes, and connection metadata. It
must not include access tokens, refresh tokens, wallet signing material, or another
creator's rows.

- [ ] **Step 2: Write failing deletion-state tests**

Cover requested, revoking-connections, deleting, completed, and retryable-failure
states. Repeated deletion requests must be idempotent.

- [ ] **Step 3: Implement export**

Add `GET /api/account/export` with `Cache-Control: no-store` and a downloadable JSON
response. Redact secrets at the query boundary.

- [ ] **Step 4: Implement resumable deletion**

Add `DELETE /api/account` requiring an explicit confirmation phrase. Mark the creator
pending deletion, revoke Composio/native connections, enqueue cleanup, then delete the
creator so existing cascades remove owned rows.

Verify Privy's supported user and server-wallet deletion/revocation behavior before
implementation. If Privy retains an identity or wallet reference, record that vendor
residual explicitly in the lifecycle result and privacy documentation rather than
claiming complete erasure.

- [ ] **Step 5: Add dashboard controls**

Provide download, destructive confirmation, progress, retry, and support states. Purge
sessionStorage/local state after deletion or logout.

- [ ] **Step 6: Run focused tests**

```bash
npm test -- tests/unit/api/account.test.ts tests/unit/jobs/account-deletion.test.ts tests/unit/dashboard/account-settings.test.tsx
npm run dashboard:build
```

- [ ] **Step 7: Commit**

```bash
git add src/api src/db/queries/account-lifecycle.ts src/jobs src/integrations/composio.ts dashboard/src tests
git commit -m "feat: add creator export and account deletion"
```

### Task 11: Publish legal, safety, and support surfaces

**Files:**

- Create: `LICENSE`
- Create: `SECURITY.md`
- Create: `dashboard/src/app/privacy/page.tsx`
- Create: `dashboard/src/app/terms/page.tsx`
- Create: `dashboard/src/app/acceptable-use/page.tsx`
- Create: `dashboard/src/app/support/page.tsx`
- Create: `dashboard/src/components/legal-footer.tsx`
- Modify: `dashboard/src/app/page.tsx`
- Modify: `dashboard/src/app/dashboard/layout.tsx`
- Modify: `dashboard/src/components/cf/settings-modal.tsx`
- Modify: `dashboard/src/app/layout.tsx`
- Test: `tests/unit/dashboard/legal-routes.test.tsx`

- [ ] **Step 1: Obtain owner-approved policy text**

The policies must cover data categories, subprocessors, retention, export/deletion,
connected apps, AI limitations, contract-review limitations, wallet sandbox status,
acceptable use, support channel, and effective date. Legal review is an external GA
dependency; do not invent jurisdiction-specific assurances.

Confirm the intended open-source license with the owner. Add the actual license file
matching `package.json` and the README badge; do not keep claiming MIT without a
tracked license. Add `SECURITY.md` with a private vulnerability-reporting channel and
supported-version policy.

- [ ] **Step 2: Write failing route/link tests**

Assert all four routes render, the landing and settings surfaces link to them, and the
support email comes from validated public configuration.

- [ ] **Step 3: Implement accessible policy pages and footer**

Use semantic headings, readable line length, print styles, version/effective date, and
stable URLs.

- [ ] **Step 4: Correct marketing claims**

Label static deal/activity cards as examples or demos. Do not imply creators or real
funds are active unless the content is backed by production data.

- [ ] **Step 5: Run tests and build**

```bash
npm test -- tests/unit/dashboard/legal-routes.test.tsx
npm run dashboard:build
```

- [ ] **Step 6: Commit**

```bash
git add LICENSE SECURITY.md dashboard/src tests/unit/dashboard
git commit -m "feat: add public policies and support surfaces"
```

### Task 12: Complete deal create, edit, detail, and archive UX

**Files:**

- Create: `dashboard/src/components/deals/deal-form.tsx`
- Create: `dashboard/src/components/deals/deal-detail.tsx`
- Modify: `dashboard/src/app/dashboard/deals/page.tsx`
- Modify: `dashboard/src/lib/api.ts`
- Modify: `src/api/routes/deals.ts`
- Modify: `src/api/contracts.ts`
- Test: `tests/unit/dashboard/deals-page.test.tsx`
- Test: `tests/unit/api/deals.test.ts`

- [ ] **Step 1: Write failing API validation tests**

Reject invalid email, out-of-range scores/probability, negative values, invalid dates,
oversized notes, malformed URLs, and unknown fields. Confirm every update remains
creator-scoped.

- [ ] **Step 2: Write failing UI workflow tests**

Cover manual creation, editing, validation messages, archive/restore, detail display,
optimistic updates, rollback on error, and keyboard operation.

- [ ] **Step 3: Add shared request schemas**

Use Zod at the route boundary and return stable field errors rather than silently
dropping invalid fields.

- [ ] **Step 4: Add focused components**

Keep form state in `deal-form.tsx`, read-only provenance/evidence in
`deal-detail.tsx`, and collection/filter orchestration in the page.

- [ ] **Step 5: Preserve agent-created deal evidence**

Display source URL, source confidence, evidence, next action, deadlines, deliverables,
and agent provenance. Manual edits must not erase evidence unless explicitly changed.

- [ ] **Step 6: Run tests and build**

```bash
npm test -- tests/unit/api/deals.test.ts tests/unit/dashboard/deals-page.test.tsx
npm run dashboard:build
```

- [ ] **Step 7: Commit**

```bash
git add src/api dashboard/src tests/unit/api tests/unit/dashboard
git commit -m "feat: complete dashboard deal management"
```

---

## Phase 4: Operability and Failure Recovery

### Task 13: Add request IDs, redaction, error reporting, and metrics

**Files:**

- Create: `src/observability/request-context.ts`
- Create: `src/observability/redaction.ts`
- Create: `src/observability/metrics.ts`
- Create: `src/observability/errors.ts`
- Create: `src/observability/logger.ts`
- Create: `scripts/check-logger-imports.ts`
- Modify: `src/api/server.ts`
- Modify: `src/index.ts`
- Modify: `dashboard/src/lib/api.ts`
- Modify: every existing `src/**/*.ts` file returned by
  `rg -l 'from "pino"' src` to import the shared logger factory
- Modify: `dashboard/src/app/api/proxy/[...path]/route.ts`
- Test: `tests/unit/observability/redaction.test.ts`
- Test: `tests/unit/api/server.test.ts`
- Test: `tests/unit/dashboard/api-errors.test.ts`

- [ ] **Step 1: Write failing redaction tests**

Test bearer tokens, Privy/Supabase/provider secrets, OAuth codes, webhook bodies,
emails, and message text. Redaction must work for nested objects and error causes.

- [ ] **Step 2: Write failing request-ID tests**

Assert the API accepts a valid inbound ID or creates one, returns it as
`X-Request-Id`, includes it in error bodies, and forwards it through the dashboard
proxy and jobs.

- [ ] **Step 3: Implement observability adapters**

Keep vendor-specific initialization behind interfaces. The application must still run
when reporting is disabled locally.

Add a CI check that rejects new direct `pino` imports outside
`src/observability/logger.ts`; this prevents future modules from bypassing redaction.

- [ ] **Step 4: Add launch metrics**

Record request latency/errors, agent latency/errors, tool/approval outcomes, queue
depth/failures, webhook duplicates, connection failures, wallet attempts, and external
provider health. Do not use unbounded creator IDs as metric labels.

- [ ] **Step 5: Add stable public errors**

Return `{ error: { code, message, requestId } }`. Log internal stack/details only after
redaction. Update the dashboard API client to parse the new envelope while temporarily
accepting the old `{ error: string }` shape during one deployment cycle so backend and
dashboard rollouts remain independently reversible.

- [ ] **Step 6: Run focused tests and full verification**

```bash
npm test -- tests/unit/observability tests/unit/api/server.test.ts tests/unit/dashboard/api-errors.test.ts
npm run verify
```

- [ ] **Step 7: Commit**

```bash
git add src/observability scripts/check-logger-imports.ts src/api src/index.ts src/agent src/auth src/bot src/jobs src/messaging src/wallet src/integrations dashboard/src/app/api dashboard/src/lib/api.ts tests
git commit -m "feat: add production observability boundaries"
```

### Task 14: Add graceful shutdown and queue recovery controls

**Files:**

- Modify: `src/index.ts`
- Modify: `src/jobs/queue.ts`
- Modify: `src/api/routes/health.ts`
- Create: `src/runtime/shutdown.ts`
- Create: `scripts/retry-failed-jobs.ts`
- Modify: `package.json`
- Test: `tests/unit/runtime/shutdown.test.ts`
- Test: `tests/unit/jobs/queue.test.ts`

- [ ] **Step 1: Write failing shutdown tests**

Assert SIGTERM stops accepting requests, stops Telegram polling when active, closes
workers/queues/Redis, waits for in-flight work up to a deadline, and then exits.

- [ ] **Step 2: Write failing dead-letter recovery tests**

Only explicitly retryable webhook/account jobs may be replayed. The command must
support `--dry-run`, job-type filters, and a maximum count.

- [ ] **Step 3: Implement a lifecycle registry**

Every long-lived resource registers an async close function. Shutdown executes them in
safe order and is idempotent.

- [ ] **Step 4: Add queue defaults**

Set bounded attempts, exponential backoff, completed-job retention, failed-job
retention, timeouts, and concurrency per job type. Avoid unlimited Redis growth.

Extend readiness checks to cover the database, Redis/queue connection, and any
required worker state. Liveness must remain cheap and independent from downstream
providers; readiness may fail when the service cannot safely accept work.

- [ ] **Step 5: Add the recovery command**

```json
"jobs:retry-failed": "tsx scripts/retry-failed-jobs.ts"
```

- [ ] **Step 6: Run tests**

```bash
npm test -- tests/unit/runtime/shutdown.test.ts tests/unit/jobs/queue.test.ts tests/unit/ops/smoke-health.test.ts
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add src/runtime src/index.ts src/jobs src/api/routes/health.ts scripts/retry-failed-jobs.ts package.json tests
git commit -m "feat: add graceful runtime and queue recovery"
```

### Task 15: Write operational runbooks and release ownership

**Files:**

- Create: `docs/runbooks/DEPLOY.md`
- Create: `docs/runbooks/ROLLBACK.md`
- Create: `docs/runbooks/INCIDENTS.md`
- Create: `docs/runbooks/SECRET_ROTATION.md`
- Create: `docs/runbooks/QUEUE_RECOVERY.md`
- Create: `docs/runbooks/BACKUP_RESTORE.md`
- Create: `docs/runbooks/ACCOUNT_DELETION.md`
- Modify: `docs/DEPLOYMENT.md`
- Modify: `README.md`

- [ ] **Step 1: Document exact deploy and rollback commands**

Include backend and dashboard, migration order, health verification, smoke commands,
rollback criteria, and who can trigger each action.

- [ ] **Step 2: Document incident severity and escalation**

Include security, cross-tenant access, duplicate external writes, wallet/payment,
provider outage, database, and queue incidents.

- [ ] **Step 3: Document key rotation and account deletion recovery**

Runbooks must contain dry-run, execution, verification, rollback, and evidence capture.

- [ ] **Step 4: Perform a staging backup/restore exercise**

Record timestamps, commands, restored row counts, and verification results in the
runbook without copying private user data.

- [ ] **Step 5: Check runbook links**

```bash
rg -n "TODO|TBD|your-api|your-org" README.md docs/runbooks docs/DEPLOYMENT.md
```

Expected: no unresolved production placeholders.

- [ ] **Step 6: Commit**

```bash
git add docs README.md
git commit -m "docs: add public launch operations runbooks"
```

---

## Phase 5: End-to-End Staging and Public Sandbox Beta

### Task 16: Add browser E2E and accessibility coverage

**Files:**

- Create: `playwright.config.ts`
- Create: `tests/e2e/fixtures/auth.ts`
- Create: `tests/e2e/onboarding.spec.ts`
- Create: `tests/e2e/agent-approval.spec.ts`
- Create: `tests/e2e/deals.spec.ts`
- Create: `tests/e2e/connections.spec.ts`
- Create: `tests/e2e/account-lifecycle.spec.ts`
- Create: `tests/e2e/accessibility.spec.ts`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Install browser-test dependencies**

Add `@playwright/test` and an accessibility scanner such as `@axe-core/playwright` as
dev dependencies.

- [ ] **Step 2: Add deterministic test identity setup**

Use a dedicated staging Privy test user or a mocked local auth boundary. Never store a
live access token in the repository; CI reads it from protected secrets.

- [ ] **Step 3: Write the critical-path tests**

Cover:

```text
sign in -> register -> onboarding -> wallet status -> agent message
-> approval preview -> approve/skip -> durable history
-> create/edit/archive deal -> connect/disconnect provider
-> export data -> request account deletion
```

- [ ] **Step 4: Add accessibility checks**

Test landing, auth gate, onboarding, chat, deals, wallet, reports, settings, policies,
and destructive confirmations at desktop and mobile widths.

- [ ] **Step 5: Add scripts and CI artifact capture**

```json
"test:e2e": "playwright test",
"test:e2e:headed": "playwright test --headed"
```

Upload traces/screenshots only on failure and ensure they do not contain secrets.

- [ ] **Step 6: Run locally**

```bash
npx playwright install --with-deps chromium
npm run test:e2e
```

Expected: all critical paths and accessibility checks pass.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json playwright.config.ts tests/e2e .github/workflows/ci.yml
git commit -m "test: add public user end to end coverage"
```

### Task 17: Provision and verify a production-like staging environment

**Files:**

- Modify: `railway.json`
- Modify: `vercel.json` only where staging findings require it
- Modify: `.github/workflows/ci.yml`
- Modify: `scripts/preflight.ts`
- Modify: `scripts/smoke-auth.ts`
- Modify: `scripts/smoke-health.ts`
- Modify: `scripts/test-mpp.ts`
- Modify: `package.json`
- Create: `scripts/smoke-messaging.ts`
- Create: `scripts/smoke-oauth.ts`
- Create: `docs/releases/STAGING_SIGNOFF.md`

- [ ] **Step 1: Install the missing deployment CLI locally**

```bash
npm i -g vercel
vercel --version
```

Use `vercel env pull` for local staging verification. Never commit the downloaded
environment file.

- [ ] **Step 2: Provision valid staging dependencies**

Create/repair Supabase, Redis, Privy, Composio, Google OAuth, Telegram, WhatsApp, AI
provider, Railway, and Vercel configuration. Correct the currently non-resolving
Supabase hostname.

- [ ] **Step 3: Apply migrations before application deployment**

```bash
npm run db:migrate:check
npm run db:migrate
```

Expected: ordered migrations apply once and checksum verification passes.

- [ ] **Step 4: Deploy backend and dashboard to staging**

Use protected staging environments and separate provider credentials from production.

Reconcile the current deployment-root mismatch before deploying: `vercel.json` is at
the repository root while GitHub Actions currently sets `working-directory` to
`dashboard`. Use the repository root for the Vercel deployment so the checked-in
configuration, build command, and output directory are actually applied, then verify
the resolved project settings with the CLI.

- [ ] **Step 5: Register all smoke scripts**

Add:

```json
"smoke:health": "node --import tsx scripts/smoke-health.ts",
"smoke:messaging": "node --import tsx scripts/smoke-messaging.ts",
"smoke:oauth": "node --import tsx scripts/smoke-oauth.ts"
```

- [ ] **Step 6: Run the complete live contract**

```bash
npm run smoke:preflight
npm run smoke:health
npm run smoke:auth
npm run test:mpp
npm run smoke:messaging
npm run smoke:oauth
npm run test:e2e
```

Expected: health/readiness, authenticated dashboard proxy, creator onboarding, funded
Tempo testnet MPP, Telegram, WhatsApp, Google OAuth, and browser flows pass.

- [ ] **Step 7: Verify failure recovery**

Replay a webhook, expire an approval, disconnect Redis briefly, force a provider 429,
roll back a dashboard deployment, and restore a staging backup. Confirm alerts and
runbooks match observed behavior.

- [ ] **Step 8: Complete staging sign-off**

Record commit SHA, deployment IDs, migration versions, smoke timestamps, known risks,
and named approvers in `docs/releases/STAGING_SIGNOFF.md`.

- [ ] **Step 9: Commit configuration and sign-off evidence**

```bash
git add railway.json vercel.json .github/workflows/ci.yml package.json package-lock.json scripts docs/releases/STAGING_SIGNOFF.md
git commit -m "ops: establish staging launch gate"
```

### Task 18: Run a controlled public sandbox beta

**Files:**

- Create: `docs/releases/SANDBOX_BETA_CHECKLIST.md`
- Create: `docs/runbooks/BETA_OPERATIONS.md`
- Modify: `src/config/env.ts`
- Modify: `src/agent/loop.ts`
- Modify: `dashboard/src/components/cf/panes/wallet-pane.tsx`
- Modify: `dashboard/src/app/page.tsx`
- Test: `tests/unit/config/feature-flags.test.ts`

- [ ] **Step 1: Add independent kill switches**

Add validated flags for new signup, agent execution, connected-app writes, MPP paid
tools, Telegram, WhatsApp, and recurring jobs. Defaults must be conservative in
production when configuration is absent.

- [ ] **Step 2: Test every switch**

Each disabled capability must fail safely with clear user messaging and no external
side effect.

- [ ] **Step 3: Finalize sandbox language**

Every balance, funding, transaction, approval cost, and landing claim must state that
Tempo funds are testnet-only and have no real value.

- [ ] **Step 4: Start with a bounded cohort**

Use staged limits even if signup is technically public: cap daily new users, agent
runs, provider writes, and testnet spend. Review errors, queue failures, costs, support
requests, and retention daily.

- [ ] **Step 5: Hold the observation window**

Do not declare beta stable until the agreed window completes with no unresolved
cross-tenant, duplicate-write, data-loss, or security incident and service objectives
remain within target.

- [ ] **Step 6: Complete beta sign-off**

Record metrics, incidents, support themes, unresolved risks, and the explicit decision
to widen, hold, or roll back.

- [ ] **Step 7: Commit**

```bash
git add docs/releases docs/runbooks src/config src/agent dashboard/src tests/unit/config
git commit -m "ops: open controlled public sandbox beta"
```

---

## Phase 6: Separately Approved Real-Value GA

### Task 19: Produce the payment and compliance decision record

**Files:**

- Create: `docs/decisions/REAL_VALUE_PAYMENTS.md`
- Create: `docs/releases/GA_PAYMENT_GATE.md`
- Modify later, only after approval: wallet, spending, payment, dashboard, policy, and
  support files identified by the chosen model

- [ ] **Step 1: Resolve external decisions before implementation**

Document supported jurisdictions, production Tempo/network choice, asset, wallet
custody model, funding/on-ramp, withdrawal, refunds, disputes, sanctions/KYC needs,
tax/reporting, transaction support, and who bears provider costs.

- [ ] **Step 2: Threat-model the chosen payment architecture**

Cover compromised accounts, prompt injection, concurrent spending, quote changes,
provider failure after payment, duplicate receipts, chain reorg/finality, key rotation,
emergency pause, and insider access.

- [ ] **Step 3: Write a new implementation plan**

Do not reuse sandbox assumptions. The GA payment plan must include atomic spend
reservation, immutable ledger reconciliation, refund/support operations, mainnet
smokes, canary limits, and independent security review.

- [ ] **Step 4: Obtain named sign-offs**

Require product, engineering, security, operations, and qualified legal/compliance
approval before any real-value feature flag can be enabled.

- [ ] **Step 5: Commit the decision record**

```bash
git add docs/decisions/REAL_VALUE_PAYMENTS.md docs/releases/GA_PAYMENT_GATE.md
git commit -m "docs: define real value payment gate"
```

---

## Final Verification Matrix

Before declaring the public sandbox beta ready, all rows must be green:

| Gate                       | Command or evidence                   | Required result                       |
| -------------------------- | ------------------------------------- | ------------------------------------- |
| Unit/integration           | `npm test`                            | All pass                              |
| Backend type/build         | `npm run build`                       | Pass                                  |
| Dashboard production build | `npm run dashboard:build`             | Pass                                  |
| Formatting                 | Prettier check                        | Pass                                  |
| Dependency policy          | Root moderate + dashboard high audits | Pass or approved narrow exception     |
| Database                   | `npm run db:migrate:check`            | Current checksums                     |
| Production config          | `npm run smoke:preflight`             | No failures                           |
| Health                     | `npm run smoke:health`                | Liveness and readiness pass           |
| Authentication             | `npm run smoke:auth`                  | API and dashboard proxy pass          |
| Sandbox payments           | `npm run test:mpp`                    | Funded testnet transaction reconciles |
| Messaging                  | `npm run smoke:messaging`             | Verified Telegram and WhatsApp pass   |
| OAuth/connections          | `npm run smoke:oauth`                 | Connect, refresh, disconnect pass     |
| Browser E2E                | `npm run test:e2e`                    | Critical paths pass                   |
| Accessibility              | Playwright/axe suite                  | No critical/serious violations        |
| Abuse controls             | Load/replay evidence                  | Quotas and idempotency hold           |
| Recovery                   | Restore and rollback exercise         | Demonstrated                          |
| Legal/support              | Published routes and owner approval   | Complete                              |
| Operations                 | Alerts and runbooks                   | Tested                                |
| Payment boundary           | Sandbox-only flag                     | Real-value disabled                   |

## Recommended Execution Order

1. Tasks 1-3: restore gates and establish safe configuration/schema evolution.
2. Tasks 4-9: close public trust-boundary risks.
3. Tasks 10-12: complete public user lifecycle and core deal management.
4. Tasks 13-15: make the service observable and recoverable.
5. Tasks 16-18: prove staging, then run the sandbox beta.
6. Task 19: begin only when the business is ready to make real-payment decisions.
