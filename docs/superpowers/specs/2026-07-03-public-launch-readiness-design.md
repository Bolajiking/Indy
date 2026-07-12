# Indyfren Public Launch Readiness Design

**Date:** 2026-07-03
**Status:** Approved direction
**Launch model:** Staging -> public sandbox beta -> production GA

## 1. Goal

Prepare Indyfren for safe public use without pretending that a testnet wallet is a
production payment product. The first public release permits open signup and real
creator workflows while all wallet activity remains clearly labelled sandbox/testnet.
Real-value payments are a separate GA gate that requires technical, operational, and
legal sign-off.

## 2. Current Baseline

The repository already contains the core product:

- Hono API with Privy authentication and creator-scoped routes.
- A Next.js dashboard with onboarding, agent chat, deal pipeline, wallet, reports,
  settings, connections, and PWA metadata.
- Telegram and WhatsApp transports.
- Twelve specialist agent skills, connected-app tools, approvals, and persistent
  creator memory.
- Privy-managed Tempo testnet wallets, spending controls, MPP attempts, receipts,
  and transaction history.
- Supabase persistence, BullMQ jobs, Railway/Vercel configuration, Docker files,
  CI, and smoke scripts.

The live audit on 2026-07-03 established the following baseline:

- `npm test`: 77 files and 352 tests pass.
- `npm run build`: passes.
- `npm run dashboard:build`: passes and emits 10 routes.
- Prettier: fails on 14 files.
- Root audit: 8 advisories, including 6 high severity.
- Dashboard audit: 4 advisories, including 2 high severity.
- Live preflight: fails for messaging secret, Telegram token, Google OAuth
  credentials, and the configured Supabase DNS target.

This means the code is functionally green but neither CI green nor live-smoke green.

## 3. Product and Release Boundaries

### Public sandbox beta

The beta includes:

- Public Privy signup and creator onboarding.
- Agent chat, approvals, connected apps, deals, reports, Telegram, and WhatsApp.
- Tempo testnet wallet activity only.
- Explicit sandbox labels wherever balances, payments, or funding appear.
- Self-service data export, connection revocation, and account deletion.
- Public policies, support contact, monitoring, rate limits, and incident response.

The beta does not include:

- Real-value custody or mainnet transfers.
- Claims that testnet balances represent cash.
- Paid subscriptions unless entitlement enforcement and billing support ship as a
  separately approved workstream.
- Unbounded autonomous writes to connected services.

### Production GA

GA adds real-value payments only after:

- A production network and funding model are selected.
- Legal review covers custody, payments, tax, privacy, and supported jurisdictions.
- Atomic spend reservation, reconciliation, refunds/support, and emergency controls
  are verified.
- Limited-value canary transactions pass with monitoring and rollback in place.

## 4. Architecture

### 4.1 Request and abuse-control boundary

All public requests pass through strict origin handling, body limits, request IDs,
and distributed rate limits. Anonymous limits use a trustworthy network identity;
authenticated limits use the resolved creator ID. Expensive agent endpoints receive
tighter quotas than ordinary dashboard reads.

Rate-limit state lives in Redis so multiple backend replicas enforce the same budget.
The implementation exposes an in-memory adapter only for deterministic unit tests.

### 4.2 Messaging ingress

Telegram and WhatsApp ingress follow the same shape:

1. Verify the provider signature or secret.
2. Parse the provider event ID and minimal routing information.
3. Claim the event idempotently.
4. Enqueue it and return immediately.
5. Process it in a BullMQ worker with bounded retries.
6. Record terminal success or failure without storing unnecessary message contents.

Telegram runs in exactly one configured mode: polling for local development or
webhook for deployed environments. Callback approvals and feedback are authorized
against the Telegram identity linked to the creator referenced by the action.

### 4.3 Data and key lifecycle

Database changes use ordered migrations instead of relying on a monolithic schema
file. The launch migration adds:

- `webhook_events` for provider event deduplication and processing state.
- Approval expiration metadata.
- Platform-secret key-version metadata.
- Account lifecycle state needed for export/deletion progress.

Platform-token encryption uses a dedicated versioned secret, not a hash of the
Supabase and Privy credentials. Reads support the current and previous key during
rotation; writes always use the current version. A migration command re-encrypts old
records before the previous key is retired.

### 4.4 Agent trust boundary

Web pages, emails, MCP output, Composio output, and paid-service responses are
untrusted data. They are delimited before returning to the model and accompanied by
an instruction that content cannot change tool policy or request credentials.

Connected-app writes remain approval-gated. Approval previews show the exact service,
destination, material arguments, and maximum cost. Approvals expire, are atomically
claimed, and cannot be executed by a different creator or messaging identity.

### 4.5 User lifecycle

Authenticated creators can:

- Export their profile, deals, transactions, messages, actions, memories, and
  connection metadata without exporting provider tokens.
- Disconnect external accounts.
- Request account deletion with explicit confirmation.

Deletion revokes external connections first, then removes creator-owned rows through
existing cascades. Failures remain visible and retryable rather than silently claiming
success. Public privacy and retention documents describe this behavior.

### 4.6 Observability and operations

Every request and job carries a correlation ID. Logs are structured and redact bearer
tokens, OAuth codes, provider tokens, webhook bodies, and message contents by default.
Metrics cover request latency/errors, agent latency/errors, approval outcomes, queue
depth/failures, webhook deduplication, wallet attempts, and external-provider health.

The API and workers support graceful shutdown. Runbooks define deploy, rollback,
secret rotation, queue recovery, incident handling, backup, and restore procedures.

## 5. User Experience Changes

- Complete deal create, edit, detail, archive, and validation flows using the existing
  API fields.
- Add clear recovery actions for wallet provisioning, expired connections, and
  unavailable providers.
- Add account export and deletion controls.
- Add privacy, terms, acceptable-use, and support links to public and authenticated
  surfaces.
- Label static landing-page examples as demonstrations until backed by live data.
- Keep all testnet wording explicit and consistent.

## 6. Error Handling

- Public API errors use stable codes and a request ID; internal details remain in
  redacted logs.
- Provider callbacks fail closed when secrets are absent in production.
- Duplicate webhook events return success without re-running side effects.
- Retryable provider failures use bounded exponential backoff.
- Permanent failures enter a dead-letter state with an operator recovery procedure.
- Account deletion and key rotation are resumable operations.
- Agent and payment failures never imply that an action completed when its durable
  record is not terminally successful.

## 7. Verification Strategy

Testing is layered:

1. Unit tests for parsers, policies, rate-limit keys, redaction, encryption versions,
   and lifecycle state transitions.
2. API tests for authentication, creator isolation, webhook verification,
   idempotency, account export/deletion, and error contracts.
3. Integration tests with Redis and Postgres/Supabase-compatible migrations.
4. Browser E2E for signup, onboarding, chat, approval, deal management, connections,
   export, and deletion.
5. Staging smokes for Privy, Supabase, Google, Telegram, WhatsApp, Composio, Redis,
   and funded testnet MPP.
6. Accessibility, mobile, webhook replay, load, backup, and restore exercises.

## 8. Release Gates

### Staging gate

- Tests, both builds, formatting, and configured audit thresholds pass.
- All required production-like environment variables validate at startup.
- Authenticated health, onboarding, OAuth, messaging, and funded MPP smokes pass.
- No unresolved critical/high vulnerability is accepted without a written mitigation.

### Sandbox beta gate

- Trust-boundary, idempotency, rate-limit, lifecycle, legal, and observability work is
  complete.
- End-to-end and accessibility suites pass.
- Backup restore and rollback are demonstrated.
- Alerts and support escalation are tested.
- A kill switch can disable agent writes and paid tools independently.

### GA gate

- Payment/compliance decisions are documented and approved.
- Real-value canary transactions reconcile correctly.
- Refund/support and emergency controls are operational.
- Service objectives hold during a limited rollout before general availability.

## 9. Non-Goals

- Adding more social OAuth providers before current integrations are reliable.
- Replacing Hono, Next.js, Supabase, Privy, BullMQ, or Composio.
- Rebuilding the dashboard design system.
- Shipping a subscription system merely because a placeholder exists.
- Migrating deployment platforms without evidence that the current split is blocking
  reliability.
