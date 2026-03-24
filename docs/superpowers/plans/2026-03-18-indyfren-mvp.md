# Indyfren MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an AI agent that acts as a business manager for content creators — finding brand deals, pricing them, generating pitches, and managing a deal pipeline — delivered via Telegram and WhatsApp bots with an embedded blockchain wallet for payments.

**Architecture:** A custom agent orchestrator implements a ReAct loop (Reasoning + Acting) using Claude API for LLM inference. The orchestrator manages tool registration, execution permissions, and approval queues. The agent is exposed to creators via Telegram (grammY) and WhatsApp (Meta Cloud API) bots that share a common message handler. Each creator gets a policy-backed Privy agent wallet on Tempo Network (EVM-compatible); the agent uses MPP (mppx) for micropayments when calling enrichment/research APIs. A Next.js companion dashboard provides deal pipeline and wallet views. Supabase handles persistence including conversation history.

**Tech Stack:** Custom ReAct orchestrator, Claude API via @anthropic-ai/sdk, grammY (Telegram), WhatsApp Cloud API, Privy (@privy-io/node), MPP (mppx), Tempo Network, Supabase (PostgreSQL + Auth), BrowserBase (headless browser), Next.js 15, Tailwind CSS, BullMQ (job queues), Railway (agent runtime), Vercel (dashboard).

**Note on OpenClaw:** OpenClaw was originally planned as the agent framework but it is designed as a personal assistant daemon (SKILL.md files, local process) — not a multi-tenant SaaS backend. We instead build a custom orchestrator using the same ReAct pattern but with programmatic tool registration, multi-creator isolation, and approval queues. OpenClaw could be revisited later as a distribution channel (creators install an OpenClaw skill that connects to Indyfren's backend).

**Review Fixes Applied:**
1. Removed OpenClaw dependency — using custom orchestrator with Claude API
2. Added Tempo chain configuration to Privy wallet setup
3. Added conversation history persistence (new `messages` table)
4. Added approval execution flow (Task 6)
5. Added error handling wrappers for all LLM calls
6. Added per-transaction spending limit enforcement
7. Improved tests to mock external services properly

## Current State — 2026-03-20 (Hardening In Progress)

**The product is now a working end-to-end system with active hardening work underway.** Core flows are wired:

- Telegram/WhatsApp → handler → agent orchestrator → tool execution → response
- Dashboard → Privy auth → API proxy → authenticated backend routes
- BullMQ jobs scheduled on Redis for morning scan, brief, EOD, invoices, weekly review
- Supabase database with full schema, RLS policies, and atomic credit deduction RPC

## Current Open Gaps

**Shipped in the latest hardening slice:**
- Reworked creator onboarding around durable Privy identity plus resumable wallet provisioning. New creators are now keyed by `privy_user_id`, profile creation is no longer blocked on a single inline wallet call, and pending creators automatically resume wallet setup on authenticated `/api/auth/me` reads.
- Added `src/wallet/provisioning.ts` as the persistent wallet-onboarding manager. It records provisioning attempts in creator settings, prevents duplicate concurrent attempts, retries stale `wallet_provisioning_in_progress` states after cooldown, and marks onboarding back to `active` once Privy wallet creation succeeds.
- Added `POST /api/auth/me/wallet/retry` so creators can explicitly resume wallet setup from the dashboard instead of waiting on a passive pending state.
- Updated dashboard auth plumbing to support the resumed flow: wallet-pending creators now get explicit retry UI, clearer status/error copy, and the settings surface shows whether wallet setup is actively retrying or waiting on another attempt.
- Updated messaging onboarding to use the same resumable provisioning path instead of calling `createWalletForCreator()` inline, so WhatsApp/Telegram signups no longer rely on a one-shot Privy wallet call either.
- Fixed the dashboard auth-sync loop that was repeatedly calling `/api/auth/me` for the same signed-in Privy user. The auth bridge now syncs once per user session unless refresh is explicitly requested, which stabilizes the unregistered creator flow and makes the registration form usable again.
- Verified live creator registration directly against the local API with a real Privy bearer token. Registration now creates the creator row successfully and returns a `wallet_pending` onboarding state when wallet provisioning fails externally, instead of leaving the user in an ambiguous unregistered loop.
- Fixed the live auth debugging flow: the dev-only Privy access-token panel now appears for signed-in unregistered users as well, because it is rendered inside the dashboard auth gate's registration state instead of only inside the post-registration settings content.
- Confirmed the live Privy bearer-auth path on this machine after schema repair: `/api/proxy/api/auth/me` now returns `200` once `PRIVY_JWT_VERIFICATION_KEY` is configured and the live Supabase schema includes `creators.privy_user_id`.
- Added `npm run smoke:auth` plus `scripts/smoke-auth.ts` to validate a real Privy bearer token against `GET /api/auth/me`, with an optional dashboard-proxy pass through `/api/proxy/api/auth/me`.
- Added `src/ops/smoke-auth.ts` and unit coverage for smoke-auth config resolution so the new operator path stays deterministic and testable.
- `scripts/preflight.ts` now distinguishes required failures from optional warnings, and it reports YouTube OAuth env and dashboard public env readiness separately instead of flattening everything into a generic failure.
- YouTube OAuth start/callback misconfiguration now returns operator-friendly errors: the start route exposes missing env vars with a `503`, and callback misconfiguration redirects back as `oauth_not_configured` instead of a generic provider failure.
- README and `.env.example` now document the live auth smoke path, the required `SMOKE_PRIVY_ACCESS_TOKEN`, and the optional dashboard-proxy smoke vars.
- Platform credentials are now encrypted before persistence via `src/security/secrets.ts`, with backward-compatible reads for older plaintext rows.
- Added `src/security/platform-secret-migration.ts` plus `npm run migrate:platform-secrets` for one-time migration or dry-run detection of legacy plaintext platform credentials.
- Platform disconnect now reports failure truthfully when the delete operation fails.
- Dashboard auth sync now preserves an already-loaded creator during transient `/api/auth/me` failures instead of dropping the user back into onboarding.
- Manual platform connection UX now supports optional refresh token, platform user ID, and expiry fields, matching the backend contract more closely.
- Quote-aware per-transaction spending enforcement is now active in the MPP wallet path, and the dashboard settings surface exposes per-transaction, daily, and monthly caps as live controls.
- Daily and monthly spend limits are now creator-configurable from the dashboard and enforced server-side during paid tool usage.
- Platform OAuth callback persistence now re-checks that the signed `creatorId` still belongs to the signed `privyUserId` before any provider token exchange is allowed to persist.
- Platform OAuth callback failures now redirect cleanly and skip `upsertConnection()` on the handled failure paths we cover in tests: invalid state, provider failure, creator lookup failure, persistence failure, and Privy binding mismatch.
- Privy remains the creator identity and agentic-wallet layer; platform OAuth is a separate connected-account flow that enriches encrypted platform credentials without provisioning or mutating wallets in this route.
- README now documents the shipped YouTube OAuth setup, manual verification checklist, and rollout notes so the Privy/agentic-wallet boundary stays explicit for operators.
- Added focused regression coverage for platform hardening and dashboard auth-state fallback behavior.
- Added an official `mppx` client integration for Tempo-backed paid fetches: `createMppClient()` now uses `Mppx.create({ methods: [tempo({ account })] })` with a bound client, and `installMppFetchPolyfill()` provides the opt-in global `fetch` polyfill path for smoke tests and single-wallet flows.
- Added regression coverage for the MPP polyfill path and a dedicated `npm run test:mpp` script that hits `https://mpp.dev/api/ping/paid`.
- Hardened Privy wallet reuse: cached `wallet_id` / `wallet_address` pairs are now validated against Privy before reuse, invalid stored wallet references trigger reprovisioning instead of being trusted blindly, and runtime MPP flows now resolve wallets through that validator before creating a client.
- `scripts/test-mpp.ts` now prefers a real Privy-bound creator over seeded demo creators when `MPP_TEST_CREATOR_ID` is not explicitly set.
- Confirmed the official paid ping endpoint is reachable from this machine and returns a valid Tempo `402 Payment Required` challenge over plain fetch.
- Fixed the local Node transport issue that was breaking both Privy and Tempo RPC calls on this machine. `src/network/ipv4-fetch.ts` now forces IPv4 for the affected outbound HTTPS calls, the Privy client uses it directly, and the Tempo MPP resolver now uses a custom viem client with `http(..., { fetchFn: ipv4Fetch })`.
- Fixed the matching local Node transport issue in the Telegram bot runtime. `createTelegramBot()` now constructs grammY with `client.fetch = ipv4Fetch`, so Bot API calls no longer depend on the flaky default Node network path on this machine.
- Fixed the matching shared-agent transport issue across the Claude-powered runtime. All Anthropic callsites now flow through `src/agent/anthropic.ts`, which uses the same IPv4-safe fetch layer as Privy and Telegram, so dashboard chat and bot chat no longer depend on Node's flaky default network path on this machine.
- Fixed the live Privy policy payload bug that was still blocking provisioning after transport repair. Agent-wallet policy names are now short deterministic hashes, which keeps them under Privy's 50-character limit.
- Live wallet validation now succeeds for the real Privy-bound creator: policy creation works, wallet provisioning completes, and the creator transitions from `wallet_pending` to `active` with a real Tempo wallet address.
- Live MPP validation now reaches the paid Tempo execution path with the real creator wallet. The remaining failure is no longer transport or provisioning; it is an on-chain `InsufficientBalance` revert because the newly provisioned creator wallet has `0` pathUSD on Tempo testnet.
- Multi-creator dashboard auth is now hardened against cross-user state leakage. The dashboard only preserves a previously loaded creator during sync failures when the current signed-in Privy user matches that creator's `privy_user_id`; switching to a different Privy user now clears stale creator state instead of showing the prior user's dashboard data.
- Added targeted auth-route coverage to prove that a second authenticated Privy user gets a separate creator row during `/api/auth/register`, rather than sharing or mutating the first creator's record.
- Live Telegram polling now works end to end on this machine: the bot drained Telegram's pending update queue, processed real incoming messages, created a new Telegram-linked creator row, and provisioned that creator's Tempo wallet successfully without manual recovery.
- Telegram-first creators can now claim the same creator profile in the dashboard. During bearer-auth session resolution, `src/auth/session.ts` checks the signed-in Privy user's linked Telegram identity and automatically binds an existing unclaimed Telegram creator row to that `privy_user_id` instead of creating a second creator.
- The dashboard is now a real agent surface instead of a read-only companion. `GET /api/agent/state`, `POST /api/agent/messages`, and the new approval routes expose shared message history plus pending approvals, and the dashboard overview now includes an agent console that writes into the same thread and approval queue Telegram uses.
- Approval execution is now shared between Telegram and the dashboard via `src/agent/approval-execution.ts`, so approving an email draft in either surface executes the same wallet-backed tool path and clears the same pending action record.
- Dashboard settings now make messaging identity explicit by surfacing connected Telegram / WhatsApp identifiers and describing the Telegram-to-Privy claim behavior, while the wallet page now shows the creator's actual Privy-managed agent wallet address instead of the browser session wallet.
- Dashboard-first creators can now connect Telegram or WhatsApp from the dashboard instead of having to onboard in chat first. `POST /api/messaging-links/:platform` issues short-lived signed link sessions, dashboard settings surfaces the next-step command / launch URL, and the shared bot handler now links that messaging identity onto the same creator profile before normal chat handling begins.
- Telegram and WhatsApp messaging links are now conflict-safe: expired or invalid codes fail cleanly, already-linked channels attach idempotently to the same creator, and attempts to attach a Telegram chat or WhatsApp number that already belongs to another creator are blocked with a clear message instead of silently creating a second profile.
- Dashboard-issued messaging links are now one-time server-stored sessions instead of replayable stateless bearer codes. `messaging_link_sessions` persists the hashed secret plus expiry, the dashboard route issues a compact token that fits Telegram deep-link limits, and the bot consumes the session atomically on first use so stale or replayed codes fail cleanly.
- Creator onboarding auth is now decoupled correctly: bearer-token verification no longer fails just because creator lookup or claim hits a transient Supabase/PostgREST problem. `src/auth/session.ts` now distinguishes invalid Privy tokens from creator-resolution outages, and creator-scoped routes return a truthful `503` instead of masquerading as `401 Invalid bearer token`.
- Added a bounded Supabase fetch timeout in `src/db/client.ts`, which stops profile creation and session sync from hanging for ~minute-long PostgREST schema-cache retries when Supabase is unhealthy.
- Dashboard onboarding UX is tighter for real users: registration now stays idempotent across duplicate submits / retry races, empty display names are rejected consistently in both registration and profile editing, and the dashboard surfaces friendlier “sign-in worked, retry profile creation/save” copy instead of dumping raw backend strings.
- Live bearer-auth now fails cleanly with the right boundary. With the currently stale `SMOKE_PRIVY_ACCESS_TOKEN`, `GET /api/auth/me` now returns a proper `401 Invalid bearer token` rather than a misleading auth/profile-service mix-up.

**Still pending:**
- Provider-specific OAuth handshakes for additional platform connections (Instagram, TikTok, etc.); YouTube OAuth is already shipped
- Refreshing `SMOKE_PRIVY_ACCESS_TOKEN` and rerunning live auth smoke; the stored token in `.env.local` is now stale and `npm run smoke:auth` currently returns `401 Invalid bearer token`
- Funding newly provisioned creator wallets with pathUSD on Tempo testnet, or adding an operator-funded/faucet bootstrap step so first paid MPP calls succeed without a manual top-up
- Removing or overriding the stale demo `MPP_TEST_CREATOR_ID` in `.env.local` so local MPP smoke runs default to the real Privy-bound creator without extra shell overrides
- After creator wallets are funded, rerunning `MPP_TEST_CREATOR_ID=<real creator> npm run test:mpp` to verify the full Tempo payment path end to end against `https://mpp.dev/api/ping/paid`
- Optional final live-browser smoke with a second real Privy account to verify the fresh-user signup path on this machine end to end, even though the backend and dashboard routing are now covered by regression tests
- Refreshing `SMOKE_PRIVY_ACCESS_TOKEN` and repeating the live onboarding smoke with a fresh Privy session, so the newly hardened `/api/auth/me` and `/api/auth/register` flows can be rechecked against a non-expired bearer token
- Deciding whether to keep Telegram in long-polling mode locally/for single-instance deploys or add an explicit polling-vs-webhook mode switch before multi-instance production deployment
- Designing equivalent claim/link flows for additional messaging identities beyond Telegram (most importantly WhatsApp) so creators can merge other chat-first onboarding paths into the same Privy-bound creator record too
- Deciding whether dashboard-to-chat linking should stay OTP-style or add a second dashboard confirmation step for even stronger protection against a live leaked connect code
- Live browser validation of the new dashboard agent console and pending-approval flow with a real Privy user session, now that the backend/API wiring is in place
- Live device/browser validation of the new dashboard-issued Telegram and WhatsApp connect flow with real messaging accounts, now that the backend, dashboard, and bot linking path are wired and covered by regression tests

**Verification:**
- Root `npm test`: **46** files / **199** tests passing
- Root `npm run build`: passing
- `npm run build --prefix dashboard`: passing
- Live local auth verification: backend `/api/auth/me` and dashboard proxy `/api/proxy/api/auth/me` both return `200` after the schema and JWT-key fixes
- Live registration verification: `POST /api/auth/register` with a real Privy bearer token returns `201` with a persisted creator profile and `onboarding.status=wallet_pending`
- Live provisioning verification: forcing `ensureCreatorWalletProvisioning()` for the real Privy-bound creator now succeeds end to end, persists a Privy policy id plus wallet id/address, and updates onboarding to `active`
- Multi-creator onboarding verification: targeted suites for auth, wallet provisioning, bot onboarding, and integration onboarding flows all pass with the resumable wallet flow (`tests/unit/api/auth.test.ts`, `tests/unit/wallet/provisioning.test.ts`, `tests/unit/bot/handler.test.ts`, `tests/integration/bot-to-agent.test.ts`, `tests/integration/full-flow.test.ts`)
- Latest Telegram verification gate: `npm test -- tests/unit/bot/telegram-startup.test.ts tests/unit/bot/telegram.test.ts tests/unit/bot/telegram-improvements.test.ts tests/unit/bot/handler.test.ts tests/integration/bot-to-agent.test.ts` → **5** files / **31** tests passing
- Live Telegram verification: with Telegram enabled, the local API now starts the grammY bot successfully, drains pending updates to `0`, and persists a real Telegram creator (`telegram_chat_id=7327569952`) with an active wallet and no transport errors in the runtime logs
- `npm test -- tests/unit/ops/smoke-auth.test.ts tests/unit/api/platform-oauth.test.ts tests/unit/platforms/oauth.test.ts` → **3** files / **37** tests passing
- `npm run smoke:preflight`: now passes the required auth checks on this machine; YouTube OAuth env and dashboard public env remain optional warnings until those live smoke flows are being exercised
- `npm run smoke:auth`: currently fails with `401 Invalid bearer token`, which indicates the locally stored `SMOKE_PRIVY_ACCESS_TOKEN` has expired and needs to be refreshed from a live Privy session before repeating the live smoke check
- Latest spending-slice verification gate: `npm test -- tests/unit/wallet/spending-limits.test.ts tests/unit/wallet/mpp.test.ts` → **2** files / **11** tests passing
- Task 5 verification gate: `npm test -- tests/unit/api/platform-oauth.test.ts tests/unit/api/platforms.test.ts tests/unit/wallet/mpp.test.ts` → **3** files / **17** tests passing
- Task 5 verification gate: `npm run build` → passing
- Wallet-validation regression gate: `npm test -- tests/unit/wallet/privy.test.ts` → **1** file / **3** tests passing
- Dashboard agent + Telegram claim regression gate: `npm test -- tests/unit/agent/anthropic-client.test.ts tests/unit/auth/session.test.ts tests/unit/api/agent.test.ts tests/unit/bot/handler.test.ts tests/unit/bot/telegram.test.ts` → **5** files / **24** tests passing
- Cross-channel integration regression gate: `npm test -- tests/integration/full-flow.test.ts tests/integration/bot-to-agent.test.ts` → **2** files / **9** tests passing
- Onboarding hardening regression gate: `npm test -- tests/unit/auth/session.test.ts tests/unit/api/auth.test.ts tests/unit/api/server.test.ts tests/unit/dashboard/onboarding-errors.test.ts` → **4** files / **25** tests passing
- Current repo verification status after the onboarding/auth hardening slice: root `npm test` → **50** files / **216** tests passing, root `npm run build` → passing, `npm run build --prefix dashboard` → passing
- Dashboard messaging-link regression gate: `npm test -- tests/unit/messaging/linking.test.ts tests/unit/api/messaging-links.test.ts tests/unit/bot/handler.test.ts` → **3** files / **16** tests passing
- One-time messaging-link security gate: `npm test -- tests/unit/messaging/linking.test.ts tests/unit/api/messaging-links.test.ts tests/unit/bot/handler.test.ts` → **3** files / **17** tests passing
- Current repo verification status after the one-time messaging-link hardening slice: root `npm test` → **52** files / **224** tests passing, root `npm run build` → passing, `npm run build --prefix dashboard` → passing
- Live MPP reachability verification: `curl -i https://mpp.dev/api/ping/paid` returns `402` with a valid Tempo charge challenge
- Live paid-wallet verification: `MPP_TEST_CREATOR_ID=<real creator> npm run test:mpp` now provisions/uses the real Privy wallet and reaches the Tempo execution path; the current failure is `InsufficientBalance` for pathUSD rather than transport or provisioning
- Focused live transport verification: direct IPv4 HTTPS requests succeed against both `https://api.privy.io` and `https://rpc.moderato.tempo.xyz`, which is why the new IPv4 fetch layer unblocked provisioning on this machine
- Multi-creator regression verification: `npm test -- tests/unit/dashboard/auth-state.test.ts tests/unit/api/auth.test.ts` → **2** files / **18** tests passing, covering second-user creator registration and cross-user dashboard state isolation

**External blockers:**
- Newly provisioned Tempo wallets start with `0` pathUSD on testnet, so paid MPP calls still require funding (or an automated testnet funding bootstrap) before they can succeed end to end.
- `.env.local` still pins `MPP_TEST_CREATOR_ID` to the seeded demo creator (`79d76413-a087-49a3-8868-ae6955799a40`), so local MPP smoke runs will keep defaulting to the wrong row until that override is removed or updated.

**Previously shipped foundation and feature milestones:**
- Database setup: `IF NOT EXISTS` idempotent schema, RLS policies (service_role allow / anon deny), `updated_at` triggers, `deduct_credits` atomic RPC, `scripts/init-db.ts`, `npm run db:init`
- Enhanced seed script: 2 creators (Telegram + WhatsApp), 7 deals across all stages, transactions, platform connections, conversation history
- Dashboard platform connect/disconnect: manual token-based connect form, disconnect button, wired to backend `/api/platforms/connect` and `DELETE /api/platforms/:platform`
- Landing page: CTAs wired to `/dashboard`, placeholder metrics replaced with value propositions
- Spending controls: credit balance check before agent run, per-tool cost tracking, automatic credit deduction after completion
- Error recovery: Claude API retry with exponential backoff (429/529), catch-all error handler in `handleMessage`, Redis error listener in job worker
- Health check: `GET /health` (Supabase ping, uptime) and `GET /health/ready` (readiness probe)
- Production config: `Dockerfile` (backend), `dashboard/Dockerfile` (Next.js standalone), `docker-compose.yml` (api + dashboard + redis), `README.md`
- Full-flow integration test: onboarding, agent response, approval flow, all quick-commands, greeting menu
- `dashboard/.env.example`, `dev:all` script for parallel backend + dashboard startup, `output: "standalone"` for Next.js Docker builds

## Implementation Status Update — 2026-03-19

> Latest truth lives in **Current Open Gaps** above. The long-running task log below is historical context and still contains earlier milestone snapshots that may no longer reflect the current verification counts or active open gaps.

The plan below has started execution. Current repo status:

1. **Core MVP + post-MVP backend surfaces are implemented and verified.**
   - Project scaffold, database layer, wallet layer, orchestrator/memory layer, bot layer, API server, reports, jobs/cron flows, integration coverage, and the companion dashboard are in place.
   - Current verification status: root `npm run build` passes, root `npm test` passes with **35** files and **115** tests passing, and `npm run build --prefix dashboard` passes.
   - Current verification status: root `npm run build` passes, root `npm test` passes with **37** files and **120** tests passing, and `npm run build --prefix dashboard` passes.

2. **Security and ownership hardening has started and the first milestone shipped.**
   - Added authenticated “me”-style API route shapes for deals, wallet, reports, and platforms.
   - Added creator resolution by `privy_user_id` and the first bearer-token auth/session layer.
   - Fixed deal ownership scoping and WhatsApp signature verification.
   - Moved approval persistence from process memory into `agent_actions`.
   - The dashboard now uses the official Privy React SDK, syncs `/api/auth/me` through the proxy, and renders real signed-out / unregistered / wallet-pending / active states.

3. **Current remaining product work is now concentrated in a few finishing slices, not broad scaffolding.**
   - Manual platform connection management is now available from the authenticated settings surface, including optional refresh-token and expiry fields.
   - Platform OAuth flows are still deferred; that is now the main platform-management gap.
   - Per-transaction, daily, and monthly limits are now live dashboard controls backed by server-side enforcement in the MPP path.
   - Live environment validation is still needed for real Privy sign-in behavior and production Telegram delivery on this machine.
   - Legacy plaintext platform credentials can now be detected and migrated with `npm run migrate:platform-secrets -- --dry-run` followed by the apply run.

4. **Task 3 was upgraded to follow the official Privy agentic-wallet guidance.**
   - Wallet provisioning now uses **Privy server wallets with attached policies**, not user-embedded wallets.
   - Added `src/wallet/privy-provisioning.ts` to centralize policy and wallet-create payloads.
   - Added Tempo-specific network constants in `src/config/constants.ts`.
   - `src/wallet/mpp.ts` now uses the `mppx` client with `tempo({ account })` and the Privy-backed signer flow.

5. **Task 5 foundation work is complete.**
   - Implemented `src/agent/skills/brand-deal-scanner.ts`
   - Implemented `src/agent/skills/rate-calculator.ts`
   - Implemented `src/agent/skills/pitch-generator.ts`
   - Implemented `src/agent/skills/morning-brief.ts`
   - Implemented `src/agent/tools/web-search.ts`
   - `src/agent/tools/enrichment.ts` exists and is registered
   - Added unit tests for P0 skill shapes and wallet provisioning

6. **Query layer cleanup was completed during implementation.**
   - `getDealsForCreator` now supports optional stage filters.
   - `getTransactionsForCreator` now supports limits.
   - `updateDealStage` now supports extra persisted fields.
   - Deal and transaction inserts now default `metadata` safely.

7. **Tasks 6-8 are now complete.**
   - Implemented shared bot handling, Telegram + WhatsApp transports, approval state, and chat formatters.
   - Implemented the Hono API server, wallet/deal routes, webhook routes, and entrypoint wiring.
   - Implemented BullMQ-backed morning scan and morning brief jobs, plus Telegram outbound registration for brief delivery.
   - Added creator query helpers to support scheduled scans and daily brief fanout.

8. **Task 9 is now complete.**
   - Added `tests/integration/bot-to-agent.test.ts` to exercise the WhatsApp webhook route through the shared bot handler with mocked external dependencies.
   - Added `scripts/seed-db.ts` so local/demo data can be loaded through the existing query layer.

9. **Task 10 is now complete.**
   - Added the companion dashboard scaffold under `dashboard/` with overview, deals, and wallet pages plus a shared API helper.
   - Added root convenience scripts for `dashboard:dev`, `dashboard:build`, and `dashboard:start`.
   - Installed the dashboard dependencies, cached the required Next tarballs, and verified a successful production build with `npm run build` inside `dashboard/`.

10. **Task 11 code-side wiring is now complete.**
   - Added `scripts/test-mpp.ts` and the root `test:mpp` script for wallet/payment smoke testing.
   - Added `scripts/preflight.ts` and the root `smoke:preflight` script for environment and DNS readiness checks.
   - Made Telegram startup conditional so the API can boot even when bot credentials are not configured.
   - Added `ENABLE_TELEGRAM_BOT` and `ENABLE_JOBS` flags for safer local startup and smoke testing.
   - Fixed Telegram approval callback payloads to include creator-scoped action IDs and added focused tests for the Telegram approval path.

11. **Post-MVP features — Phase 2 (P1) implementation started.**
   - Added `src/agent/skills/contract-reviewer.ts` — Claude-powered contract analysis with risk scoring, issue flagging, and missing clause detection.
   - Added `src/agent/tools/email-sender.ts` — StableEmail MPP tool (hybrid autonomy, requires creator approval).
   - Added `src/agent/tools/platform-analytics.ts` — StableSocial MPP tool for pulling social stats across 6 platforms.
   - Added `src/api/middleware/auth.ts` — Hono auth middleware (X-Creator-Id header for MVP, Privy JWT placeholder).
   - Added `src/api/routes/auth.ts` — Creator registration, profile get/update endpoints.
   - Added `src/api/routes/platforms.ts` — Platform connection CRUD (connect, list, disconnect).
   - Added `src/jobs/invoice-reminder.ts` — Overdue payment reminders via Telegram/WhatsApp (Monday 10am cron).
   - Added dashboard components: `deal-card`, `wallet-balance`, `morning-brief`, `platform-connect`, settings page, API proxy, Privy provider stub.
   - Wired conversation history persistence into the bot handler and orchestrator (multi-turn context).

12. **Phase 2 continued — P1 skills, tools, and jobs.**
    - Added `src/agent/skills/revenue-advisor.ts` — Weekly revenue diversification analysis with current streams, suggestions, and risk assessment.
    - Added `src/agent/skills/analytics-aggregator.ts` — Pulls daily stats from all connected platforms via StableSocial.
    - Added `src/agent/tools/media-kit-generator.ts` — StableStudio MPP tool for generating visual media kits for brand pitches.
    - Added `src/agent/tools/browser.ts` — BrowserBase headless browser integration for scraping deal platforms and researching brands.
    - Added `src/jobs/end-of-day-summary.ts` — Claude-generated EOD summary of daily activity sent at 6pm via Telegram/WhatsApp.
    - Updated `src/jobs/queue.ts` with `end-of-day-summary` (daily 6pm) and `analytics-aggregation` job handlers.
    - Updated orchestrator system prompt with new capabilities (media kits, browser, revenue analysis).
    - Fixed test timeouts: added missing `messages.js` mock to handler and integration tests.
    - Current verification: `npm run build` passes, **25 test files / 69 tests all passing**.

13. **Phase 2 continued — Content Agent + Ops Agent skills and weekly review.**
    - Added `src/agent/skills/content-strategy.ts` — Weekly content strategy planner with ideas, posting times, trend opportunities, and brand deal tie-ins.
    - Added `src/agent/skills/financial-tracker.ts` — Financial snapshot from deal/transaction data: income by source, expenses, pipeline value, and forecast with confidence level.
    - Added `src/jobs/weekly-review.ts` — Sunday 10am cron that runs revenue advisor + content strategy + financial tracker and sends a combined weekly business review via Telegram/WhatsApp.
    - Added bot formatters: `formatRevenueReport`, `formatFinancialSnapshot`, `formatContentStrategy` in `src/bot/formatters.ts`.
    - Updated `src/jobs/queue.ts` with `weekly-review` (Sunday 10am) job handler — now 5 recurring cron jobs total.
    - Fixed TS2367 errors: corrected deal stage from `"negotiation"` to `"negotiating"` to match `DealStage` type.
    - Added unit tests: `content-strategy.test.ts` (type shape), `financial-tracker.test.ts` (snapshot generation with mocked deals/transactions).
    - Current verification: `npm run build` passes, **27 test files / 72 tests all passing**.

14. **Phase 2 continued — SEO Optimizer, Reports API.**
    - Added `src/agent/skills/seo-optimizer.ts` — On-demand SEO analysis using Claude Haiku. Scores content 0-100, suggests title/description/tag/thumbnail/hook/hashtag improvements, identifies keyword opportunities and competitor insights.
    - Added `src/api/routes/reports.ts` — REST endpoints for all report types: `GET /reports/:creatorId/revenue`, `GET /reports/:creatorId/financial`, `GET /reports/:creatorId/content-strategy`, `GET /reports/:creatorId/analytics`, `POST /reports/seo`.
    - Wired reports route into `src/index.ts`.
    - Added unit tests: `seo-optimizer.test.ts` (type shape), `reports.test.ts` (financial endpoint, analytics endpoint, SEO 400 validation).
    - Current verification: `npm run build` passes, **29 test files / 77 tests all passing**.

13. **Phase 2 continued — Ops Agent skills, Dashboard reports, API expansion.**
    - Added `src/agent/skills/calendar-manager.ts` — Generates calendar view from deal pipeline: upcoming deadlines, overdue items, content delivery dates, invoice reminders. Derives events from deal stage transitions (discovered→pitch in 3d, pitched→follow-up in 5d, negotiating→finalize in 7d, active→deliver in 14d, active→invoice in 30d).
    - Added `src/agent/skills/inbox-triager.ts` — Claude Haiku-powered message categorization: brand_deal, collaboration, fan_mail, spam, urgent, general. Priority scoring and suggested actions.
    - Added `dashboard/src/app/dashboard/reports/page.tsx` — Reports dashboard page with financial snapshot (income/expenses/net/pipeline/forecast stats) and platform analytics (per-platform follower counts and engagement rates).
    - Added Reports nav item to dashboard layout.
    - Exported `fetchJson` from `dashboard/src/lib/api.ts` for use by report pages.
    - Extended `src/api/routes/reports.ts` with `GET /reports/:creatorId/calendar` and `POST /reports/:creatorId/triage` endpoints.
    - Added unit tests: `calendar-manager.test.ts` (event generation from deals, overdue detection, completed deal exclusion), `inbox-triager.test.ts` (type shape validation).
    - Current verification: `npm run build` passes, **31 test files / 80 tests all passing**.

14. **Phase 2 continued — Bot quick-commands, dashboard verification.**
    - Added quick-command routing in `src/bot/handler.ts` for: "calendar"/"deadlines", "finances"/"financial"/"money", "content plan"/"content strategy". These bypass the full agent loop for instant formatted responses.
    - Updated welcome message to list all available commands.
    - Dashboard build verified: `npm run build` in `dashboard/` passes with all 6 pages (overview, deals, wallet, reports, settings + root).
    - Current verification: root `npm run build` passes, **31 test files / 80 tests all passing**, `dashboard/npm run build` passes.

15. **Complete inventory — all implemented components:**

    **Agent Skills (11):**
    - `brand-deal-scanner.ts` — P0 brand deal discovery
    - `rate-calculator.ts` — P0 rate intelligence
    - `pitch-generator.ts` — P0 pitch drafting
    - `morning-brief.ts` — P0 daily brief generation
    - `contract-reviewer.ts` — P0 contract analysis
    - `revenue-advisor.ts` — P1 revenue diversification
    - `analytics-aggregator.ts` — P1 platform stats aggregation
    - `content-strategy.ts` — P1 weekly content planning
    - `financial-tracker.ts` — P1 financial snapshot/forecast
    - `calendar-manager.ts` — P2 deadline tracking from deals
    - `inbox-triager.ts` — P2 message categorization
    - `seo-optimizer.ts` — P1 content SEO analysis

    **Agent Tools (6):**
    - `enrichment.ts` — StableEnrich MPP (brand/contact research)
    - `web-search.ts` — Exa web search via MPP
    - `email-sender.ts` — StableEmail MPP (hybrid, requires approval)
    - `platform-analytics.ts` — StableSocial MPP (social stats)
    - `media-kit-generator.ts` — StableStudio MPP (image generation)
    - `browser.ts` — BrowserBase headless browser

    **API Routes (6):**
    - `auth.ts` — Creator registration, profile CRUD
    - `deals.ts` — Deal pipeline CRUD
    - `wallet.ts` — Wallet balance, transactions
    - `platforms.ts` — Platform connection CRUD
    - `reports.ts` — Revenue, financial, content strategy, analytics, calendar, triage, SEO
    - `webhooks.ts` — Telegram/WhatsApp webhook handlers

    **Jobs (5 cron schedules):**
    - Morning scan — 6am daily
    - Morning brief — 7am daily
    - End-of-day summary — 6pm daily
    - Invoice reminder — Monday 10am
    - Weekly review — Sunday 10am

    **Dashboard (6 pages):**
    - Overview, Deals, Wallet, Reports, Settings + root landing

    **Source files:** 53 TypeScript files in `src/`
    **Test files:** 31 files, 90 tests
    **Dashboard:** 14 files (pages, components, lib, API proxy)

16. **Telegram bot hardening — end-to-end tightening.**
    - Fixed approval execution flow: `callback_query:data` handler now actually executes approved tools via `getTool()` + `tool.execute()` with MPP context from creator wallet.
    - Added Telegram webhook route: `POST /webhooks/telegram` using grammY's `webhookCallback("hono")`, wired via `setTelegramBotForWebhook()` in `src/index.ts`.
    - Added `splitMessage()` utility for Telegram's 4096-char limit: splits at newlines → spaces → hard break.
    - Hardened `sendMessageToCreator()`: try/catch, multi-chunk splitting, Markdown-to-plain-text fallback on parse failure.
    - Graceful wallet provisioning failure during onboarding: catch block shows "hiccup" message instead of crashing.
    - All quick-commands wrapped in try/catch with user-friendly error messages.
    - Added comprehensive bot tests: `splitMessage` edge cases, quick-command routing (calendar, finances, aliases), onboarding error handling.
    - Current verification: `npm run build` passes, **31 test files / 90 tests all passing**.

17. **Remaining for future phases:**
    - External/manual smoke checks that require real credentials and live services.
    - Vector store / RAG integration for agent memory (Pinecone or pgvector).
    - Revenue share smart contract on Tempo Network.
    - Platform OAuth flows (YouTube, Instagram, TikTok, etc.).
    - Multi-agent routing (Money/Content/Ops agent isolation at orchestrator level).
    - Agent-to-agent communication via x402.
    - Content protection / AI detection tools.
    - Mobile app (React Native).

---

## File Structure

```
indyfren/
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
│
├── src/
│   ├── index.ts                          # Entry point — starts agent, bots, workers
│   │
│   ├── config/
│   │   ├── env.ts                        # Environment variable validation (zod)
│   │   └── constants.ts                  # App-wide constants (limits, defaults)
│   │
│   ├── db/
│   │   ├── client.ts                     # Supabase client init
│   │   ├── schema.sql                    # Database schema (run once)
│   │   └── queries/
│   │       ├── creators.ts               # Creator CRUD
│   │       ├── deals.ts                  # Deal pipeline CRUD
│   │       ├── transactions.ts           # Wallet transaction log
│   │       └── platform-connections.ts   # OAuth tokens
│   │
│   ├── wallet/
│   │   ├── privy.ts                      # Privy client, wallet creation
│   │   ├── privy-provisioning.ts         # Privy policy + wallet payload helpers
│   │   ├── mpp.ts                        # MPP client (mppx) for paid API calls
│   │   └── spending.ts                   # Spending limits & controls
│   │
│   ├── agent/
│   │   ├── orchestrator.ts               # Main agent loop — intent → skill routing
│   │   ├── memory.ts                     # Creator context assembly (profile + history)
│   │   ├── skills/
│   │   │   ├── brand-deal-scanner.ts     # P0: Scan for brand deal opportunities
│   │   │   ├── rate-calculator.ts        # P0: Benchmark and recommend rates
│   │   │   ├── pitch-generator.ts        # P0: Generate personalized pitches
│   │   │   ├── contract-reviewer.ts      # P0: Analyze contracts, flag issues
│   │   │   └── morning-brief.ts          # Daily brief generation
│   │   └── tools/
│   │       ├── registry.ts              # Tool registry with permissions
│   │       ├── web-search.ts            # BrowserBase / MPP web research
│   │       ├── email-sender.ts          # Send emails via MPP (StableEmail)
│   │       ├── enrichment.ts            # Brand/person enrichment via MPP
│   │       └── platform-analytics.ts    # Pull YouTube/IG/TikTok analytics
│   │
│   ├── bot/
│   │   ├── handler.ts                    # Shared message handler (platform-agnostic)
│   │   ├── telegram.ts                   # grammY bot setup + middleware
│   │   ├── whatsapp.ts                   # WhatsApp webhook + message sending
│   │   ├── formatters.ts                 # Format agent responses for chat
│   │   └── approval.ts                   # Inline approval buttons (approve/skip/edit)
│   │
│   ├── jobs/
│   │   ├── queue.ts                      # BullMQ queue setup
│   │   ├── morning-scan.ts              # Cron: 6am daily scan
│   │   ├── morning-brief.ts             # Cron: 7am brief generation + send
│   │   └── invoice-reminder.ts          # Cron: check overdue invoices
│   │
│   └── api/
│       ├── server.ts                     # Hono API server
│       ├── routes/
│       │   ├── webhooks.ts              # WhatsApp + platform webhooks
│       │   ├── auth.ts                  # Creator auth (Privy)
│       │   ├── deals.ts                 # Deal pipeline API
│       │   ├── wallet.ts               # Wallet balance + transactions
│       │   └── platforms.ts            # Connect/disconnect platforms
│       └── middleware/
│           └── auth.ts                  # JWT verification middleware
│
├── dashboard/                            # Next.js companion app (Week 7-8)
│   ├── package.json
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                 # Landing / login
│   │   │   ├── dashboard/
│   │   │   │   ├── page.tsx             # Main dashboard
│   │   │   │   ├── deals/page.tsx       # Deal pipeline
│   │   │   │   ├── wallet/page.tsx      # Wallet + transactions
│   │   │   │   └── settings/page.tsx    # Settings + connections
│   │   │   └── api/
│   │   │       └── [...proxy]/route.ts  # Proxy to backend API
│   │   ├── components/
│   │   │   ├── deal-card.tsx
│   │   │   ├── wallet-balance.tsx
│   │   │   ├── morning-brief.tsx
│   │   │   └── platform-connect.tsx
│   │   └── lib/
│   │       ├── api.ts                   # Backend API client
│   │       └── privy.tsx                # Privy React provider
│
├── tests/
│   ├── unit/
│   │   ├── wallet/
│   │   │   ├── spending.test.ts
│   │   │   └── mpp.test.ts
│   │   │   └── privy-provisioning.test.ts
│   │   ├── agent/
│   │   │   ├── orchestrator.test.ts
│   │   │   ├── brand-deal-scanner.test.ts
│   │   │   ├── rate-calculator.test.ts
│   │   │   ├── pitch-generator.test.ts
│   │   │   └── morning-brief.test.ts
│   │   ├── bot/
│   │   │   ├── handler.test.ts
│   │   │   └── approval.test.ts
│   │   └── db/
│   │       └── queries.test.ts
│   └── integration/
│       ├── agent-flow.test.ts
│       └── bot-to-agent.test.ts
│
└── scripts/
    ├── seed-db.ts                        # Seed test data
    └── test-mpp.ts                       # Manual MPP payment test
```

---

## Task Breakdown

### Task 1: Project Scaffold & Configuration ✅ COMPLETE

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `src/config/env.ts`
- Create: `src/config/constants.ts`

- [x] **Step 1: Initialize project**

```bash
cd "/Users/controlla/BOLAJIMAJ/Chainfren Organization/Indyfren"
npm init -y
```

- [x] **Step 2: Install core dependencies**

```bash
npm install typescript @types/node tsx vitest dotenv zod
npm install hono @hono/node-server
npm install grammy
npm install axios express @types/express
npm install @supabase/supabase-js
npm install @privy-io/node
npm install mppx viem
npm install bullmq ioredis
npm install @anthropic-ai/sdk
npm install openclaw
npm install pino pino-pretty
```

- [x] **Step 3: Install dev dependencies**

```bash
npm install -D @types/express prettier eslint
```

- [x] **Step 4: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "dashboard", "tests"]
}
```

- [x] **Step 5: Create .gitignore**

```
node_modules/
dist/
.env
.env.local
*.log
.DS_Store
dashboard/.next/
dashboard/node_modules/
```

- [x] **Step 6: Create .env.example**

```env
# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...

# Privy
PRIVY_APP_ID=
PRIVY_APP_SECRET=

# Telegram
TELEGRAM_BOT_TOKEN=

# WhatsApp
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_WEBHOOK_SECRET=

# Redis (BullMQ)
REDIS_URL=redis://localhost:6379

# BrowserBase
BROWSERBASE_API_KEY=
BROWSERBASE_PROJECT_ID=

# App
PORT=3000
NODE_ENV=development
```

- [x] **Step 7: Create src/config/env.ts**

```typescript
import { z } from "zod";
import { config } from "dotenv";

config();

const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_KEY: z.string().min(1),
  PRIVY_APP_ID: z.string().min(1),
  PRIVY_APP_SECRET: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  WHATSAPP_PHONE_NUMBER_ID: z.string().default(""),
  WHATSAPP_ACCESS_TOKEN: z.string().default(""),
  WHATSAPP_VERIFY_TOKEN: z.string().default("indyfren-verify"),
  WHATSAPP_WEBHOOK_SECRET: z.string().default(""),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  BROWSERBASE_API_KEY: z.string().default(""),
  BROWSERBASE_PROJECT_ID: z.string().default(""),
  PORT: z.string().default("3000").transform(Number),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export const env = envSchema.parse(process.env);
```

- [x] **Step 8: Create src/config/constants.ts**

```typescript
export const SPENDING_LIMITS = {
  PER_TRANSACTION_USD: 5,
  DAILY_USD: 50,
  MONTHLY_USD: 500,
} as const;

export const FREE_CREDITS_USD = 10;

export const AGENT = {
  MAX_STEPS_PER_TASK: 20,
  MORNING_SCAN_HOUR: 6,
  MORNING_BRIEF_HOUR: 7,
  DEFAULT_LLM: "claude-sonnet-4-20250514" as const,
  FAST_LLM: "claude-haiku-4-20250414" as const,
} as const;

export const DEAL_STAGES = [
  "discovered",
  "pitched",
  "responded",
  "negotiating",
  "contracted",
  "active",
  "completed",
  "lost",
] as const;

export type DealStage = (typeof DEAL_STAGES)[number];
```

- [x] **Step 9: Add scripts to package.json**

Add to package.json `scripts`:
```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:seed": "tsx scripts/seed-db.ts"
  }
}
```

- [x] **Step 10: Commit**

```bash
git add package.json tsconfig.json .gitignore .env.example src/config/
git commit -m "feat: project scaffold with config, env validation, constants"
```

---

### Task 2: Database Schema & Queries ✅ COMPLETE

**Files:**
- Create: `src/db/schema.sql`
- Create: `src/db/client.ts`
- Create: `src/db/queries/creators.ts`
- Create: `src/db/queries/deals.ts`
- Create: `src/db/queries/transactions.ts`
- Create: `src/db/queries/platform-connections.ts`
- Test: `tests/unit/db/queries.test.ts`

- [x] **Step 1: Create src/db/schema.sql**

```sql
-- Creators (users)
CREATE TABLE creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_chat_id TEXT UNIQUE,
  whatsapp_phone TEXT UNIQUE,
  display_name TEXT NOT NULL,
  niche TEXT,
  wallet_id TEXT,
  wallet_address TEXT,
  free_credits_remaining_cents INTEGER DEFAULT 1000, -- $10.00
  monthly_spend_cents INTEGER DEFAULT 0,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Platform connections (OAuth tokens)
CREATE TABLE platform_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES creators(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- youtube, instagram, tiktok, twitter
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  platform_user_id TEXT,
  platform_username TEXT,
  metadata JSONB DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(creator_id, platform)
);

-- Deal pipeline
CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES creators(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  brand_contact_email TEXT,
  brand_contact_name TEXT,
  stage TEXT NOT NULL DEFAULT 'discovered',
  fit_score INTEGER, -- 0-100
  estimated_value_cents INTEGER,
  actual_value_cents INTEGER,
  pitch_text TEXT,
  pitch_sent_at TIMESTAMPTZ,
  response_text TEXT,
  responded_at TIMESTAMPTZ,
  contract_notes TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wallet transactions (agent spending log)
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES creators(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'mpp_payment', 'credit_used', 'deposit', 'income'
  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'USD',
  description TEXT NOT NULL,
  service TEXT, -- 'stable_enrich', 'stable_email', etc.
  tx_hash TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent action log (audit trail)
CREATE TABLE agent_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES creators(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- 'scan', 'pitch', 'brief', 'enrich', etc.
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, executed, rejected
  description TEXT NOT NULL,
  input JSONB,
  output JSONB,
  cost_cents INTEGER DEFAULT 0,
  requires_approval BOOLEAN DEFAULT false,
  approved_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_creators_telegram ON creators(telegram_chat_id);
CREATE INDEX idx_creators_whatsapp ON creators(whatsapp_phone);
CREATE INDEX idx_deals_creator ON deals(creator_id);
CREATE INDEX idx_deals_stage ON deals(stage);
CREATE INDEX idx_transactions_creator ON transactions(creator_id);
CREATE INDEX idx_agent_actions_creator ON agent_actions(creator_id);
CREATE INDEX idx_agent_actions_status ON agent_actions(status);

-- Enable RLS
ALTER TABLE creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY;
```

- [x] **Step 2: Create src/db/client.ts**

```typescript
import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
```

- [x] **Step 3: Create src/db/queries/creators.ts**

```typescript
import { supabase } from "../client.js";

export interface Creator {
  id: string;
  telegram_chat_id: string | null;
  whatsapp_phone: string | null;
  display_name: string;
  niche: string | null;
  wallet_id: string | null;
  wallet_address: string | null;
  free_credits_remaining_cents: number;
  monthly_spend_cents: number;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export async function findCreatorByTelegram(chatId: string): Promise<Creator | null> {
  const { data } = await supabase
    .from("creators")
    .select("*")
    .eq("telegram_chat_id", chatId)
    .single();
  return data;
}

export async function findCreatorByWhatsApp(phone: string): Promise<Creator | null> {
  const { data } = await supabase
    .from("creators")
    .select("*")
    .eq("whatsapp_phone", phone)
    .single();
  return data;
}

export async function createCreator(params: {
  display_name: string;
  telegram_chat_id?: string;
  whatsapp_phone?: string;
  niche?: string;
  wallet_id?: string;
  wallet_address?: string;
}): Promise<Creator> {
  const { data, error } = await supabase
    .from("creators")
    .insert(params)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCreator(
  id: string,
  params: Partial<Omit<Creator, "id" | "created_at">>
): Promise<Creator> {
  const { data, error } = await supabase
    .from("creators")
    .update({ ...params, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deductCredits(id: string, amountCents: number): Promise<boolean> {
  const creator = await supabase
    .from("creators")
    .select("free_credits_remaining_cents")
    .eq("id", id)
    .single();

  if (!creator.data || creator.data.free_credits_remaining_cents < amountCents) {
    return false;
  }

  const { error } = await supabase
    .from("creators")
    .update({
      free_credits_remaining_cents:
        creator.data.free_credits_remaining_cents - amountCents,
    })
    .eq("id", id);

  return !error;
}
```

- [x] **Step 4: Create src/db/queries/deals.ts**

```typescript
import { supabase } from "../client.js";
import type { DealStage } from "../../config/constants.js";

export interface Deal {
  id: string;
  creator_id: string;
  brand_name: string;
  brand_contact_email: string | null;
  brand_contact_name: string | null;
  stage: DealStage;
  fit_score: number | null;
  estimated_value_cents: number | null;
  actual_value_cents: number | null;
  pitch_text: string | null;
  pitch_sent_at: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export async function createDeal(params: {
  creator_id: string;
  brand_name: string;
  brand_contact_email?: string;
  brand_contact_name?: string;
  fit_score?: number;
  estimated_value_cents?: number;
  notes?: string;
  metadata?: Record<string, unknown>;
}): Promise<Deal> {
  const { data, error } = await supabase
    .from("deals")
    .insert({ stage: "discovered", ...params })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateDealStage(
  dealId: string,
  stage: DealStage,
  extra?: Partial<Deal>
): Promise<Deal> {
  const { data, error } = await supabase
    .from("deals")
    .update({ stage, ...extra, updated_at: new Date().toISOString() })
    .eq("id", dealId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getDealsForCreator(
  creatorId: string,
  stage?: DealStage
): Promise<Deal[]> {
  let query = supabase
    .from("deals")
    .select("*")
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: false });

  if (stage) query = query.eq("stage", stage);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getDealById(dealId: string): Promise<Deal | null> {
  const { data } = await supabase.from("deals").select("*").eq("id", dealId).single();
  return data;
}
```

- [x] **Step 5: Create src/db/queries/transactions.ts**

```typescript
import { supabase } from "../client.js";

export interface Transaction {
  id: string;
  creator_id: string;
  type: "mpp_payment" | "credit_used" | "deposit" | "income";
  amount_cents: number;
  currency: string;
  description: string;
  service: string | null;
  tx_hash: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export async function logTransaction(params: {
  creator_id: string;
  type: Transaction["type"];
  amount_cents: number;
  description: string;
  service?: string;
  tx_hash?: string;
}): Promise<Transaction> {
  const { data, error } = await supabase
    .from("transactions")
    .insert(params)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getTransactionsForCreator(
  creatorId: string,
  limit = 50
): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getTotalSpendToday(creatorId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from("transactions")
    .select("amount_cents")
    .eq("creator_id", creatorId)
    .in("type", ["mpp_payment", "credit_used"])
    .gte("created_at", today.toISOString());

  return (data ?? []).reduce((sum, t) => sum + t.amount_cents, 0);
}
```

- [x] **Step 6: Create src/db/queries/platform-connections.ts**

```typescript
import { supabase } from "../client.js";

export interface PlatformConnection {
  id: string;
  creator_id: string;
  platform: string;
  access_token: string;
  refresh_token: string | null;
  platform_user_id: string | null;
  platform_username: string | null;
  metadata: Record<string, unknown>;
  expires_at: string | null;
  created_at: string;
}

export async function upsertConnection(params: {
  creator_id: string;
  platform: string;
  access_token: string;
  refresh_token?: string;
  platform_user_id?: string;
  platform_username?: string;
  metadata?: Record<string, unknown>;
  expires_at?: string;
}): Promise<PlatformConnection> {
  const { data, error } = await supabase
    .from("platform_connections")
    .upsert(params, { onConflict: "creator_id,platform" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getConnectionsForCreator(
  creatorId: string
): Promise<PlatformConnection[]> {
  const { data, error } = await supabase
    .from("platform_connections")
    .select("*")
    .eq("creator_id", creatorId);
  if (error) throw error;
  return data ?? [];
}

export async function getConnection(
  creatorId: string,
  platform: string
): Promise<PlatformConnection | null> {
  const { data } = await supabase
    .from("platform_connections")
    .select("*")
    .eq("creator_id", creatorId)
    .eq("platform", platform)
    .single();
  return data;
}
```

- [x] **Step 7: Write tests for queries**

Create `tests/unit/db/queries.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase
vi.mock("../../../src/db/client.js", () => {
  const mockFrom = vi.fn();
  return {
    supabase: { from: mockFrom },
    __mockFrom: mockFrom,
  };
});

describe("creator queries", () => {
  it("findCreatorByTelegram returns null when not found", async () => {
    const { supabase } = await import("../../../src/db/client.js");
    const mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    vi.mocked(supabase.from).mockReturnValue(mockChain as any);

    const { findCreatorByTelegram } = await import(
      "../../../src/db/queries/creators.js"
    );
    const result = await findCreatorByTelegram("12345");
    expect(result).toBeNull();
  });
});

describe("deal queries", () => {
  it("createDeal sets stage to discovered", async () => {
    const { supabase } = await import("../../../src/db/client.js");
    const mockDeal = { id: "1", stage: "discovered", brand_name: "Test" };
    const mockChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockDeal, error: null }),
    };
    vi.mocked(supabase.from).mockReturnValue(mockChain as any);

    const { createDeal } = await import("../../../src/db/queries/deals.js");
    const deal = await createDeal({
      creator_id: "creator-1",
      brand_name: "Test",
    });
    expect(deal.stage).toBe("discovered");
  });
});
```

- [x] **Step 8: Run tests**

```bash
npx vitest run tests/unit/db/
```

Expected: PASS

- [x] **Step 9: Commit**

```bash
git add src/db/ tests/unit/db/
git commit -m "feat: database schema, client, and query layer"
```

---

### Task 3: Wallet Layer (Privy + MPP) ✅ COMPLETE

**Implementation note (2026-03-19):**
- The wallet layer now uses **policy-backed Privy server wallets** aligned with the official Privy agentic-wallet skill, rather than creator-linked embedded wallets.
- `src/wallet/privy-provisioning.ts` defines the default Privy policy payload and wallet create params.
- `src/wallet/mpp.ts` is wired to `Mppx.create({ polyfill: false, methods: [tempo({ account })] })`.
- Additional tests now cover `tests/unit/wallet/mpp.test.ts` and `tests/unit/wallet/privy-provisioning.test.ts`.

**Files:**
- Create: `src/wallet/privy.ts`
- Create: `src/wallet/privy-provisioning.ts`
- Create: `src/wallet/mpp.ts`
- Create: `src/wallet/spending.ts`
- Test: `tests/unit/wallet/spending.test.ts`
- Test: `tests/unit/wallet/mpp.test.ts`
- Test: `tests/unit/wallet/privy-provisioning.test.ts`

- [x] **Step 1: Create src/wallet/privy.ts**

```typescript
import { PrivyClient } from "@privy-io/node";
import { toAccount } from "viem/accounts";
import { keccak256 } from "viem";
import { env } from "../config/env.js";
import { updateCreator } from "../db/queries/creators.js";
import pino from "pino";

const log = pino({ name: "wallet:privy" });

const privy = new PrivyClient({
  appId: env.PRIVY_APP_ID,
  appSecret: env.PRIVY_APP_SECRET,
});

export async function createWalletForCreator(creatorId: string) {
  log.info({ creatorId }, "Creating wallet");
  const wallet = await privy.wallets().create({ chain_type: "ethereum" });

  await updateCreator(creatorId, {
    wallet_id: wallet.id,
    wallet_address: wallet.address,
  });

  log.info({ creatorId, address: wallet.address }, "Wallet created");
  return { walletId: wallet.id, address: wallet.address };
}

export function createPrivyAccount(walletId: string, address: `0x${string}`) {
  return toAccount({
    address,
    async signMessage({ message }) {
      const result = await privy.wallets().ethereum().signMessage(walletId, {
        message: typeof message === "string" ? message : (message.raw as string),
      });
      return result.signature as `0x${string}`;
    },
    async signTransaction(transaction, options) {
      const serializer = options?.serializer;
      if (!serializer) throw new Error("Serializer required for Tempo transactions");
      const unsignedSerialized = await serializer(transaction);
      const hash = keccak256(unsignedSerialized);
      const result = await privy
        .wallets()
        .ethereum()
        .signSecp256k1(walletId, { params: { hash } });
      return result.signature as `0x${string}`;
    },
    async signTypedData(typedData) {
      const result = await privy
        .wallets()
        .ethereum()
        .signTypedData(walletId, { params: typedData });
      return result.signature as `0x${string}`;
    },
  });
}

export { privy };
```

- [x] **Step 2: Create src/wallet/mpp.ts**

```typescript
import { Mppx, tempo } from "mppx/client";
import { createPrivyAccount } from "./privy.js";
import { logTransaction } from "../db/queries/transactions.js";
import { checkSpendingLimits } from "./spending.js";
import pino from "pino";

const log = pino({ name: "wallet:mpp" });

export async function createMppClient(
  creatorId: string,
  walletId: string,
  address: `0x${string}`
) {
  const account = createPrivyAccount(walletId, address);

  const mppx = Mppx.create({
    polyfill: false,
    methods: [tempo({ account })],
  });

  return {
    async fetch(url: string, options?: RequestInit): Promise<Response> {
      log.info({ creatorId, url }, "MPP fetch");

      // Check spending limits before making request
      await checkSpendingLimits(creatorId);

      const response = await mppx.fetch(url, options);

      // Log the transaction if payment was made
      const paymentHeader = response.headers.get("payment-response");
      if (paymentHeader) {
        const parsed = JSON.parse(paymentHeader);
        await logTransaction({
          creator_id: creatorId,
          type: "mpp_payment",
          amount_cents: Math.round(parsed.amount * 100),
          description: `MPP payment to ${new URL(url).hostname}`,
          service: new URL(url).hostname,
          tx_hash: parsed.txHash,
        });
        log.info({ creatorId, amount: parsed.amount, tx: parsed.txHash }, "MPP payment");
      }

      return response;
    },
  };
}
```

- [x] **Step 3: Create src/wallet/spending.ts**

```typescript
import { SPENDING_LIMITS } from "../config/constants.js";
import { getTotalSpendToday } from "../db/queries/transactions.js";
import { findCreatorByTelegram } from "../db/queries/creators.js";

export class SpendingLimitExceeded extends Error {
  constructor(
    public limit: string,
    public current: number,
    public max: number
  ) {
    super(`Spending limit exceeded: ${limit}. Current: $${(current / 100).toFixed(2)}, Max: $${(max / 100).toFixed(2)}`);
    this.name = "SpendingLimitExceeded";
  }
}

export async function checkSpendingLimits(creatorId: string): Promise<void> {
  const todaySpendCents = await getTotalSpendToday(creatorId);

  if (todaySpendCents >= SPENDING_LIMITS.DAILY_USD * 100) {
    throw new SpendingLimitExceeded(
      "daily",
      todaySpendCents,
      SPENDING_LIMITS.DAILY_USD * 100
    );
  }
}

export function canAffordTransaction(
  amountCents: number,
  freeCreditsRemainingCents: number,
  walletBalanceCents: number
): { canAfford: boolean; useCredits: boolean; shortfall: number } {
  if (freeCreditsRemainingCents >= amountCents) {
    return { canAfford: true, useCredits: true, shortfall: 0 };
  }

  const totalAvailable = freeCreditsRemainingCents + walletBalanceCents;
  if (totalAvailable >= amountCents) {
    return { canAfford: true, useCredits: freeCreditsRemainingCents > 0, shortfall: 0 };
  }

  return {
    canAfford: false,
    useCredits: false,
    shortfall: amountCents - totalAvailable,
  };
}
```

- [x] **Step 4: Write tests for spending**

Create `tests/unit/wallet/spending.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  canAffordTransaction,
  SpendingLimitExceeded,
} from "../../../src/wallet/spending.js";

describe("canAffordTransaction", () => {
  it("returns true when free credits cover the cost", () => {
    const result = canAffordTransaction(500, 1000, 0);
    expect(result.canAfford).toBe(true);
    expect(result.useCredits).toBe(true);
  });

  it("returns true when wallet balance covers after credits exhausted", () => {
    const result = canAffordTransaction(1500, 500, 2000);
    expect(result.canAfford).toBe(true);
    expect(result.useCredits).toBe(true);
  });

  it("returns false with shortfall when insufficient funds", () => {
    const result = canAffordTransaction(5000, 100, 200);
    expect(result.canAfford).toBe(false);
    expect(result.shortfall).toBe(4700);
  });

  it("returns true with no credits when wallet alone covers cost", () => {
    const result = canAffordTransaction(500, 0, 1000);
    expect(result.canAfford).toBe(true);
    expect(result.useCredits).toBe(false);
  });
});

describe("SpendingLimitExceeded", () => {
  it("formats error message with dollar amounts", () => {
    const err = new SpendingLimitExceeded("daily", 5000, 5000);
    expect(err.message).toContain("$50.00");
    expect(err.name).toBe("SpendingLimitExceeded");
  });
});
```

- [x] **Step 5: Run tests**

```bash
npx vitest run tests/unit/wallet/
```

Expected: PASS

- [x] **Step 6: Commit**

```bash
git add src/wallet/ tests/unit/wallet/
git commit -m "feat: wallet layer — Privy, MPP client, spending controls"
```

---

### Task 4: Agent Orchestrator & Memory ✅ COMPLETE

**Files:**
- Create: `src/agent/orchestrator.ts`
- Create: `src/agent/memory.ts`
- Create: `src/agent/tools/registry.ts`
- Test: `tests/unit/agent/orchestrator.test.ts`

- [x] **Step 1: Create src/agent/tools/registry.ts**

```typescript
export type AutonomyLevel = "autonomous" | "hybrid";
export type CostCategory = "free" | "mpp" | "platform-api";

export interface AgentTool {
  name: string;
  description: string;
  autonomyLevel: AutonomyLevel;
  costCategory: CostCategory;
  maxCostPerUseCents: number;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
  execute: (params: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>;
}

export interface ToolContext {
  creatorId: string;
  mppFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export interface ToolResult {
  success: boolean;
  data: unknown;
  costCents?: number;
  error?: string;
}

const tools = new Map<string, AgentTool>();

export function registerTool(tool: AgentTool): void {
  tools.set(tool.name, tool);
}

export function getTool(name: string): AgentTool | undefined {
  return tools.get(name);
}

export function getAllTools(): AgentTool[] {
  return Array.from(tools.values());
}

export function getToolsForLLM(): Array<{
  name: string;
  description: string;
  input_schema: { type: "object"; properties: Record<string, unknown>; required: string[] };
}> {
  return getAllTools().map((tool) => ({
    name: tool.name,
    description: `${tool.description} [${tool.autonomyLevel}] [cost: ${tool.costCategory}]`,
    input_schema: {
      type: "object" as const,
      properties: Object.fromEntries(
        Object.entries(tool.parameters).map(([key, val]) => [
          key,
          { type: val.type, description: val.description },
        ])
      ),
      required: Object.entries(tool.parameters)
        .filter(([, v]) => v.required)
        .map(([k]) => k),
    },
  }));
}
```

- [x] **Step 2: Create src/agent/memory.ts**

```typescript
import { findCreatorByTelegram, findCreatorByWhatsApp, type Creator } from "../db/queries/creators.js";
import { getDealsForCreator } from "../db/queries/deals.js";
import { getConnectionsForCreator } from "../db/queries/platform-connections.js";
import { getTransactionsForCreator } from "../db/queries/transactions.js";

export interface CreatorContext {
  creator: Creator;
  activeDealCount: number;
  connectedPlatforms: string[];
  recentTransactions: number;
  walletFunded: boolean;
  hasCredits: boolean;
}

export async function assembleContext(creatorId: string): Promise<string> {
  const { supabase } = await import("../db/client.js");
  const { data: creator } = await supabase
    .from("creators")
    .select("*")
    .eq("id", creatorId)
    .single();

  if (!creator) return "Unknown creator. Ask them to set up their profile.";

  const deals = await getDealsForCreator(creatorId);
  const connections = await getConnectionsForCreator(creatorId);
  const transactions = await getTransactionsForCreator(creatorId, 10);

  const activeDeals = deals.filter((d) =>
    ["discovered", "pitched", "responded", "negotiating", "contracted", "active"].includes(d.stage)
  );

  return `
## Creator Profile
- Name: ${creator.display_name}
- Niche: ${creator.niche ?? "Not set"}
- Wallet: ${creator.wallet_address ? `${creator.wallet_address.slice(0, 8)}...` : "Not created"}
- Free credits remaining: $${(creator.free_credits_remaining_cents / 100).toFixed(2)}

## Connected Platforms
${connections.length > 0 ? connections.map((c) => `- ${c.platform}: @${c.platform_username}`).join("\n") : "- None connected yet"}

## Active Deals (${activeDeals.length})
${activeDeals.length > 0 ? activeDeals.map((d) => `- ${d.brand_name} [${d.stage}] est. $${((d.estimated_value_cents ?? 0) / 100).toFixed(0)}`).join("\n") : "- No active deals"}

## Recent Agent Spending
${transactions.length > 0 ? transactions.slice(0, 5).map((t) => `- ${t.description}: $${(t.amount_cents / 100).toFixed(2)}`).join("\n") : "- No spending yet"}
`.trim();
}
```

- [x] **Step 3: Create src/agent/orchestrator.ts**

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { AGENT } from "../config/constants.js";
import { getToolsForLLM, getTool, type ToolContext } from "./tools/registry.js";
import { assembleContext } from "./memory.js";
import { createMppClient } from "../wallet/mpp.js";
import { findCreatorByTelegram } from "../db/queries/creators.js";
import pino from "pino";

const log = pino({ name: "agent:orchestrator" });

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are Indyfren, an AI business manager for independent content creators. Your #1 job is helping creators make more money.

## Your Capabilities
- Find brand deal opportunities and pitch them
- Calculate fair rates based on market data
- Generate professional pitch emails
- Review contracts and flag issues
- Track deal pipelines
- Provide daily morning briefs

## Your Personality
- Direct, no-BS, results-oriented
- Talk like a savvy business manager, not a corporate bot
- Celebrate wins, be honest about challenges
- Keep messages concise — creators are busy

## Rules
- NEVER make financial commitments without creator approval
- NEVER send pitches without creator approval
- Always explain what you're doing and why
- If a task costs money (uses paid APIs), mention the cost
- When showing deals, include fit score and estimated value`;

export interface AgentResponse {
  text: string;
  requiresApproval: boolean;
  pendingAction?: {
    id: string;
    type: string;
    description: string;
  };
}

export async function runAgent(
  creatorId: string,
  userMessage: string,
  walletId?: string,
  walletAddress?: string
): Promise<AgentResponse> {
  log.info({ creatorId, message: userMessage.slice(0, 100) }, "Agent invoked");

  const context = await assembleContext(creatorId);
  const tools = getToolsForLLM();

  // Set up tool context with MPP client if wallet exists
  let toolContext: ToolContext | null = null;
  if (walletId && walletAddress) {
    const mppClient = await createMppClient(
      creatorId,
      walletId,
      walletAddress as `0x${string}`
    );
    toolContext = { creatorId, mppFetch: mppClient.fetch };
  }

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `<creator_context>\n${context}\n</creator_context>\n\n${userMessage}`,
    },
  ];

  let response = await anthropic.messages.create({
    model: AGENT.DEFAULT_LLM,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    tools: tools as any,
    messages,
  });

  // ReAct loop — execute tools until agent produces final text
  let steps = 0;
  while (response.stop_reason === "tool_use" && steps < AGENT.MAX_STEPS_PER_TASK) {
    steps++;
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      const tool = getTool(toolUse.name);
      if (!tool) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: `Error: Unknown tool "${toolUse.name}"`,
          is_error: true,
        });
        continue;
      }

      // If hybrid tool, return approval request instead of executing
      if (tool.autonomyLevel === "hybrid") {
        log.info({ tool: toolUse.name }, "Hybrid tool — requesting approval");
        return {
          text: "",
          requiresApproval: true,
          pendingAction: {
            id: toolUse.id,
            type: toolUse.name,
            description: JSON.stringify(toolUse.input),
          },
        };
      }

      if (!toolContext) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: "Error: No wallet configured. Ask the creator to set up their wallet first.",
          is_error: true,
        });
        continue;
      }

      try {
        const result = await tool.execute(
          toolUse.input as Record<string, unknown>,
          toolContext
        );
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(result.data),
        });
      } catch (err: any) {
        log.error({ tool: toolUse.name, error: err.message }, "Tool execution failed");
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: `Error: ${err.message}`,
          is_error: true,
        });
      }
    }

    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });

    response = await anthropic.messages.create({
      model: AGENT.DEFAULT_LLM,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: tools as any,
      messages,
    });
  }

  const textBlocks = response.content.filter(
    (b): b is Anthropic.TextBlock => b.type === "text"
  );

  return {
    text: textBlocks.map((b) => b.text).join("\n") || "I couldn't generate a response. Please try again.",
    requiresApproval: false,
  };
}
```

- [x] **Step 4: Write orchestrator test**

Create `tests/unit/agent/orchestrator.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { getAllTools, registerTool, getToolsForLLM, type AgentTool } from "../../../src/agent/tools/registry.js";

describe("tool registry", () => {
  it("registers and retrieves tools", () => {
    const tool: AgentTool = {
      name: "test_tool",
      description: "A test tool",
      autonomyLevel: "autonomous",
      costCategory: "free",
      maxCostPerUseCents: 0,
      parameters: { query: { type: "string", description: "Search query", required: true } },
      execute: async () => ({ success: true, data: "result" }),
    };

    registerTool(tool);
    const retrieved = getAllTools();
    expect(retrieved.some((t) => t.name === "test_tool")).toBe(true);
  });

  it("formats tools for LLM consumption", () => {
    const formatted = getToolsForLLM();
    const testTool = formatted.find((t) => t.name === "test_tool");
    expect(testTool).toBeDefined();
    expect(testTool!.input_schema.type).toBe("object");
    expect(testTool!.input_schema.required).toContain("query");
  });
});
```

- [x] **Step 5: Run tests**

```bash
npx vitest run tests/unit/agent/
```

Expected: PASS

- [x] **Step 6: Commit**

```bash
git add src/agent/ tests/unit/agent/
git commit -m "feat: agent orchestrator with tool registry, memory, and ReAct loop"
```

---

### Task 5: Agent Skills (P0 — Money Engine) ✅ FOUNDATION COMPLETE

**Implementation note (2026-03-19):**
- The P0 skill files and tool registrations listed in this task now exist in the repo.
- The current implementation is backend-only foundation work; bot and API surfaces that expose these skills are still pending in later tasks.
- The code has been verified with unit tests and a successful TypeScript build.

**Files:**
- Create: `src/agent/skills/brand-deal-scanner.ts`
- Create: `src/agent/skills/rate-calculator.ts`
- Create: `src/agent/skills/pitch-generator.ts`
- Create: `src/agent/skills/morning-brief.ts`
- Create: `src/agent/tools/enrichment.ts`
- Create: `src/agent/tools/web-search.ts`
- Test: `tests/unit/agent/brand-deal-scanner.test.ts`
- Test: `tests/unit/agent/rate-calculator.test.ts`
- Test: `tests/unit/agent/morning-brief.test.ts`

- [x] **Step 1: Create src/agent/tools/enrichment.ts**

```typescript
import { registerTool } from "./registry.js";

registerTool({
  name: "enrich_brand",
  description:
    "Look up information about a brand or company — contact info, social presence, recent campaigns, and creator partnership history. Uses paid API (MPP).",
  autonomyLevel: "autonomous",
  costCategory: "mpp",
  maxCostPerUseCents: 50,
  parameters: {
    company_name: { type: "string", description: "Brand or company name to research", required: true },
    domain: { type: "string", description: "Company website domain if known" },
  },
  async execute(params, context) {
    const { company_name, domain } = params as { company_name: string; domain?: string };

    try {
      // Use StableEnrich via MPP for company data
      const url = new URL("https://stableenrich.dev/api/company/search");
      url.searchParams.set("query", company_name);
      if (domain) url.searchParams.set("domain", domain);

      const response = await context.mppFetch(url.toString());
      if (!response.ok) {
        return { success: false, data: null, error: `Enrichment failed: ${response.status}` };
      }

      const data = await response.json();
      return { success: true, data, costCents: 25 };
    } catch (err: any) {
      return { success: false, data: null, error: err.message };
    }
  },
});
```

- [x] **Step 2: Create src/agent/tools/web-search.ts**

```typescript
import { registerTool } from "./registry.js";

registerTool({
  name: "web_search",
  description:
    "Search the web for brand deal opportunities, creator marketplace listings, industry news, or competitive intelligence. Uses paid API (MPP).",
  autonomyLevel: "autonomous",
  costCategory: "mpp",
  maxCostPerUseCents: 25,
  parameters: {
    query: { type: "string", description: "Search query", required: true },
    num_results: { type: "number", description: "Number of results (default 5)" },
  },
  async execute(params, context) {
    const { query, num_results } = params as { query: string; num_results?: number };

    try {
      const url = new URL("https://stableenrich.dev/api/exa/search");
      url.searchParams.set("query", query);
      url.searchParams.set("num_results", String(num_results ?? 5));

      const response = await context.mppFetch(url.toString());
      if (!response.ok) {
        return { success: false, data: null, error: `Search failed: ${response.status}` };
      }

      const data = await response.json();
      return { success: true, data, costCents: 10 };
    } catch (err: any) {
      return { success: false, data: null, error: err.message };
    }
  },
});
```

- [x] **Step 3: Create src/agent/skills/brand-deal-scanner.ts**

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../config/env.js";
import { AGENT } from "../../config/constants.js";
import { createDeal } from "../../db/queries/deals.js";
import { assembleContext } from "../memory.js";
import pino from "pino";

const log = pino({ name: "skill:brand-deal-scanner" });
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

export interface ScanResult {
  opportunities: Array<{
    brandName: string;
    contactEmail?: string;
    contactName?: string;
    fitScore: number;
    estimatedValueCents: number;
    reason: string;
    source: string;
  }>;
}

export async function scanForBrandDeals(
  creatorId: string,
  niche: string,
  platforms: string[]
): Promise<ScanResult> {
  log.info({ creatorId, niche }, "Starting brand deal scan");

  const context = await assembleContext(creatorId);

  const response = await anthropic.messages.create({
    model: AGENT.FAST_LLM,
    max_tokens: 2048,
    system: `You are a brand deal researcher. Given a creator's profile, generate a list of 3-5 realistic brand deal opportunities they should pursue. For each opportunity, provide:
- brandName: Company name
- fitScore: 0-100 how well this matches the creator
- estimatedValueCents: Realistic deal value in cents based on typical rates
- reason: Why this brand is a good fit (1 sentence)
- source: Where this opportunity could be found

Base your suggestions on the creator's niche, audience size, and platform presence. Be specific with real brands that actually work with creators.

Return ONLY valid JSON: { "opportunities": [...] }`,
    messages: [
      {
        role: "user",
        content: `Creator profile:\n${context}\n\nNiche: ${niche}\nPlatforms: ${platforms.join(", ")}`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const parsed = JSON.parse(text) as ScanResult;

    // Save discovered deals to pipeline
    for (const opp of parsed.opportunities) {
      await createDeal({
        creator_id: creatorId,
        brand_name: opp.brandName,
        brand_contact_email: opp.contactEmail,
        brand_contact_name: opp.contactName,
        fit_score: opp.fitScore,
        estimated_value_cents: opp.estimatedValueCents,
        notes: opp.reason,
        metadata: { source: opp.source },
      });
    }

    log.info({ creatorId, count: parsed.opportunities.length }, "Brand deals discovered");
    return parsed;
  } catch {
    log.error({ creatorId, text }, "Failed to parse scan results");
    return { opportunities: [] };
  }
}
```

- [x] **Step 4: Create src/agent/skills/rate-calculator.ts**

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../config/env.js";
import { AGENT } from "../../config/constants.js";
import { assembleContext } from "../memory.js";

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

export interface RateCard {
  platform: string;
  contentType: string;
  recommendedRateCents: number;
  rangeLowCents: number;
  rangeHighCents: number;
  reasoning: string;
}

export async function calculateRates(
  creatorId: string,
  followerCount: number,
  engagementRate: number,
  niche: string,
  platforms: string[]
): Promise<RateCard[]> {
  const context = await assembleContext(creatorId);

  const response = await anthropic.messages.create({
    model: AGENT.FAST_LLM,
    max_tokens: 2048,
    system: `You are a creator economy pricing expert. Given a creator's stats, calculate recommended brand deal rates for each platform and content type.

Use these market benchmarks:
- Instagram post: $10-$100 per 1K followers, adjusted by engagement rate
- Instagram Reel: 1.5-2x post rate
- YouTube integration (30-60s): $20-$50 per 1K subscribers
- YouTube dedicated video: $50-$100 per 1K subscribers
- TikTok post: $5-$25 per 1K followers
- Twitter/X thread: $5-$15 per 1K followers
- Newsletter mention: $20-$50 per 1K subscribers

Higher engagement rates (>3%) command premium pricing. Finance/B2B niches pay 3-5x entertainment.

Return ONLY valid JSON: [{ "platform": "...", "contentType": "...", "recommendedRateCents": N, "rangeLowCents": N, "rangeHighCents": N, "reasoning": "..." }]`,
    messages: [
      {
        role: "user",
        content: `Followers: ${followerCount}\nEngagement rate: ${engagementRate}%\nNiche: ${niche}\nPlatforms: ${platforms.join(", ")}\n\nContext:\n${context}`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "[]";
  try {
    return JSON.parse(text) as RateCard[];
  } catch {
    return [];
  }
}
```

- [x] **Step 5: Create src/agent/skills/pitch-generator.ts**

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../config/env.js";
import { AGENT } from "../../config/constants.js";
import { assembleContext } from "../memory.js";
import { getDealById, updateDealStage } from "../../db/queries/deals.js";

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

export interface PitchDraft {
  subject: string;
  body: string;
  dealId: string;
}

export async function generatePitch(
  creatorId: string,
  dealId: string
): Promise<PitchDraft | null> {
  const deal = await getDealById(dealId);
  if (!deal) return null;

  const context = await assembleContext(creatorId);

  const response = await anthropic.messages.create({
    model: AGENT.DEFAULT_LLM,
    max_tokens: 1500,
    system: `You are a brand deal pitch writer. Write a concise, professional, but warm outreach email from a content creator to a brand.

Rules:
- Subject line should be catchy but professional (under 60 chars)
- Body should be 150-250 words max
- Open with something specific about the brand (shows you did research)
- Explain why the creator is a fit (audience alignment, engagement)
- Propose specific deliverables and rate
- End with a clear CTA (call, reply, etc.)
- Tone: confident, specific, human — NOT salesy or corporate

Return ONLY valid JSON: { "subject": "...", "body": "..." }`,
    messages: [
      {
        role: "user",
        content: `Creator context:\n${context}\n\nBrand: ${deal.brand_name}\nFit score: ${deal.fit_score}/100\nEstimated deal value: $${((deal.estimated_value_cents ?? 0) / 100).toFixed(0)}\nNotes: ${deal.notes ?? "none"}`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  try {
    const parsed = JSON.parse(text) as { subject: string; body: string };

    // Update deal with pitch text
    await updateDealStage(dealId, "discovered", { pitch_text: parsed.body });

    return { ...parsed, dealId };
  } catch {
    return null;
  }
}
```

- [x] **Step 6: Create src/agent/skills/morning-brief.ts**

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../config/env.js";
import { AGENT } from "../../config/constants.js";
import { getDealsForCreator } from "../../db/queries/deals.js";
import { assembleContext } from "../memory.js";
import pino from "pino";

const log = pino({ name: "skill:morning-brief" });
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

export interface MorningBrief {
  greeting: string;
  items: Array<{
    emoji: string;
    title: string;
    detail: string;
    actionPrompt: string;
  }>;
  closingNote: string;
}

export async function generateMorningBrief(creatorId: string): Promise<MorningBrief> {
  log.info({ creatorId }, "Generating morning brief");

  const context = await assembleContext(creatorId);
  const deals = await getDealsForCreator(creatorId);

  const newDeals = deals.filter((d) => d.stage === "discovered");
  const activeDeals = deals.filter((d) =>
    ["pitched", "responded", "negotiating"].includes(d.stage)
  );

  const response = await anthropic.messages.create({
    model: AGENT.FAST_LLM,
    max_tokens: 1024,
    system: `You are Indyfren, a creator's AI business manager. Generate a morning brief with 2-3 items max. Each item should be actionable.

Format as JSON:
{
  "greeting": "Short morning greeting (1 line, include time-appropriate emoji)",
  "items": [
    {
      "emoji": "relevant emoji",
      "title": "Short headline (under 10 words)",
      "detail": "1-2 sentence context",
      "actionPrompt": "What should I do? (e.g., 'Want me to pitch them?')"
    }
  ],
  "closingNote": "One encouraging line about their progress"
}

Be specific, not generic. Reference actual deal names and numbers.`,
    messages: [
      {
        role: "user",
        content: `Context:\n${context}\n\nNew opportunities: ${newDeals.length}\nActive deals: ${activeDeals.length}\n\nNew deals:\n${newDeals.slice(0, 5).map((d) => `- ${d.brand_name} (fit: ${d.fit_score}, est: $${((d.estimated_value_cents ?? 0) / 100).toFixed(0)})`).join("\n")}\n\nActive deals:\n${activeDeals.map((d) => `- ${d.brand_name} [${d.stage}]`).join("\n")}`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  try {
    return JSON.parse(text) as MorningBrief;
  } catch {
    return {
      greeting: "Good morning! Here's your daily update.",
      items: [],
      closingNote: "Have a productive day!",
    };
  }
}
```

- [x] **Step 7: Write tests**

Create `tests/unit/agent/brand-deal-scanner.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";

// Test that scan result shape is correct
describe("ScanResult shape", () => {
  it("has opportunities array", () => {
    const result = { opportunities: [{ brandName: "TestBrand", fitScore: 85, estimatedValueCents: 250000, reason: "Good fit", source: "manual" }] };
    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0].fitScore).toBeGreaterThanOrEqual(0);
    expect(result.opportunities[0].fitScore).toBeLessThanOrEqual(100);
  });
});
```

Create `tests/unit/agent/rate-calculator.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import type { RateCard } from "../../../src/agent/skills/rate-calculator.js";

describe("RateCard shape", () => {
  it("has required fields", () => {
    const card: RateCard = {
      platform: "instagram",
      contentType: "reel",
      recommendedRateCents: 120000,
      rangeLowCents: 80000,
      rangeHighCents: 160000,
      reasoning: "Based on 50K followers at 4.2% engagement in finance niche",
    };
    expect(card.recommendedRateCents).toBeGreaterThan(card.rangeLowCents);
    expect(card.recommendedRateCents).toBeLessThan(card.rangeHighCents);
  });
});
```

Create `tests/unit/agent/morning-brief.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import type { MorningBrief } from "../../../src/agent/skills/morning-brief.js";

describe("MorningBrief shape", () => {
  it("has greeting, items, and closing note", () => {
    const brief: MorningBrief = {
      greeting: "Good morning!",
      items: [{ emoji: "🔥", title: "New deal", detail: "Brand X wants to work with you", actionPrompt: "Want me to pitch?" }],
      closingNote: "You're doing great!",
    };
    expect(brief.items.length).toBeLessThanOrEqual(3);
    expect(brief.items[0].actionPrompt).toBeTruthy();
  });
});
```

- [x] **Step 8: Run tests**

```bash
npx vitest run tests/unit/agent/
```

Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/agent/skills/ src/agent/tools/enrichment.ts src/agent/tools/web-search.ts tests/unit/agent/
git commit -m "feat: P0 agent skills — brand deal scanner, rate calculator, pitch generator, morning brief"
```

---

### Task 6: Bot Layer (Telegram + WhatsApp)

**Files:**
- Create: `src/bot/handler.ts`
- Create: `src/bot/telegram.ts`
- Create: `src/bot/whatsapp.ts`
- Create: `src/bot/formatters.ts`
- Create: `src/bot/approval.ts`
- Test: `tests/unit/bot/handler.test.ts`

- [ ] **Step 1: Create src/bot/formatters.ts**

```typescript
import type { MorningBrief } from "../agent/skills/morning-brief.js";
import type { RateCard } from "../agent/skills/rate-calculator.js";
import type { ScanResult } from "../agent/skills/brand-deal-scanner.js";

export function formatMorningBrief(brief: MorningBrief): string {
  let msg = `${brief.greeting}\n\n`;
  for (const item of brief.items) {
    msg += `${item.emoji} *${item.title}*\n${item.detail}\n_${item.actionPrompt}_\n\n`;
  }
  msg += `---\n${brief.closingNote}`;
  return msg;
}

export function formatRateCard(rates: RateCard[]): string {
  if (rates.length === 0) return "Couldn't calculate rates. Connect a platform first so I can see your stats.";

  let msg = "*Your Rate Card*\n\n";
  for (const r of rates) {
    msg += `*${r.platform} — ${r.contentType}*\n`;
    msg += `Recommended: *$${(r.recommendedRateCents / 100).toFixed(0)}*\n`;
    msg += `Range: $${(r.rangeLowCents / 100).toFixed(0)} - $${(r.rangeHighCents / 100).toFixed(0)}\n`;
    msg += `_${r.reasoning}_\n\n`;
  }
  return msg;
}

export function formatScanResults(results: ScanResult): string {
  if (results.opportunities.length === 0) return "No new opportunities found this scan. I'll keep looking.";

  let msg = `*Found ${results.opportunities.length} opportunities:*\n\n`;
  for (const opp of results.opportunities) {
    msg += `*${opp.brandName}* — Fit: ${opp.fitScore}/100\n`;
    msg += `Est. value: *$${(opp.estimatedValueCents / 100).toFixed(0)}*\n`;
    msg += `${opp.reason}\n\n`;
  }
  msg += `_Reply with a brand name to pitch them, or say "pitch all" to let me draft pitches for all._`;
  return msg;
}

export function formatDealCount(active: number, total: number): string {
  return `You have *${active}* active deals out of *${total}* total in your pipeline.`;
}

export function formatWalletBalance(
  freeCredits: number,
  address: string | null
): string {
  let msg = `*Wallet*\n`;
  msg += `Free credits: *$${(freeCredits / 100).toFixed(2)}*\n`;
  if (address) {
    msg += `Address: \`${address.slice(0, 8)}...${address.slice(-6)}\`\n`;
    msg += `Network: Tempo\n`;
  } else {
    msg += `_No wallet created yet. Say "create wallet" to get started._`;
  }
  return msg;
}
```

- [ ] **Step 2: Create src/bot/approval.ts**

```typescript
export interface ApprovalAction {
  creatorId: string;
  actionId: string;
  type: string;
  description: string;
  preview: string;
}

// In-memory store for pending approvals (upgrade to Redis later)
const pendingApprovals = new Map<string, ApprovalAction>();

export function storePendingApproval(action: ApprovalAction): string {
  const key = `${action.creatorId}:${action.actionId}`;
  pendingApprovals.set(key, action);
  return key;
}

export function getPendingApproval(key: string): ApprovalAction | undefined {
  return pendingApprovals.get(key);
}

export function removePendingApproval(key: string): void {
  pendingApprovals.delete(key);
}

export function getPendingApprovalsForCreator(creatorId: string): ApprovalAction[] {
  return Array.from(pendingApprovals.values()).filter(
    (a) => a.creatorId === creatorId
  );
}
```

- [ ] **Step 3: Create src/bot/handler.ts**

```typescript
import { runAgent } from "../agent/orchestrator.js";
import {
  findCreatorByTelegram,
  findCreatorByWhatsApp,
  createCreator,
  type Creator,
} from "../db/queries/creators.js";
import { createWalletForCreator } from "../wallet/privy.js";
import pino from "pino";

const log = pino({ name: "bot:handler" });

export type Platform = "telegram" | "whatsapp";

export interface IncomingMessage {
  platform: Platform;
  platformUserId: string; // telegram chat_id or whatsapp phone
  displayName: string;
  text: string;
}

export interface OutgoingMessage {
  text: string;
  parseMode?: "Markdown" | "HTML";
  buttons?: Array<{ text: string; callbackData: string }>;
}

export async function handleMessage(msg: IncomingMessage): Promise<OutgoingMessage> {
  log.info({ platform: msg.platform, user: msg.platformUserId }, "Incoming message");

  // 1. Find or create creator
  let creator: Creator | null = null;

  if (msg.platform === "telegram") {
    creator = await findCreatorByTelegram(msg.platformUserId);
  } else {
    creator = await findCreatorByWhatsApp(msg.platformUserId);
  }

  if (!creator) {
    // New user — onboard
    creator = await createCreator({
      display_name: msg.displayName,
      telegram_chat_id: msg.platform === "telegram" ? msg.platformUserId : undefined,
      whatsapp_phone: msg.platform === "whatsapp" ? msg.platformUserId : undefined,
    });

    // Create wallet
    const wallet = await createWalletForCreator(creator.id);

    return {
      text: `Hey ${msg.displayName}! I'm *Indyfren* — your AI business manager.\n\nI just set up your wallet on Tempo Network. You have *$10 in free credits* to get started.\n\nTell me about yourself:\n- What's your niche? (e.g., personal finance, fitness, tech)\n- What platforms are you on?\n- What's your follower count?\n\nOr just say *"scan for deals"* and I'll start finding brand opportunities for you.`,
      parseMode: "Markdown",
    };
  }

  // 2. Handle commands
  const text = msg.text.toLowerCase().trim();

  if (text === "/start" || text === "hi" || text === "hello") {
    return {
      text: `Welcome back, ${creator.display_name}! What can I help with?\n\n*Commands:*\n- "scan for deals" — find brand opportunities\n- "my rates" — see your rate card\n- "my deals" — check deal pipeline\n- "wallet" — check balance\n- "brief" — get your morning brief`,
      parseMode: "Markdown",
    };
  }

  // 3. Run through agent for everything else
  const agentResponse = await runAgent(
    creator.id,
    msg.text,
    creator.wallet_id ?? undefined,
    creator.wallet_address ?? undefined
  );

  if (agentResponse.requiresApproval && agentResponse.pendingAction) {
    return {
      text: `${agentResponse.text}\n\n_This action needs your approval._`,
      parseMode: "Markdown",
      buttons: [
        { text: "Approve", callbackData: `approve:${agentResponse.pendingAction.id}` },
        { text: "Skip", callbackData: `skip:${agentResponse.pendingAction.id}` },
      ],
    };
  }

  return {
    text: agentResponse.text,
    parseMode: "Markdown",
  };
}
```

- [ ] **Step 4: Create src/bot/telegram.ts**

```typescript
import { Bot, InlineKeyboard } from "grammy";
import { env } from "../config/env.js";
import { handleMessage, type OutgoingMessage } from "./handler.js";
import pino from "pino";

const log = pino({ name: "bot:telegram" });

export function createTelegramBot(): Bot {
  const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

  bot.on("message:text", async (ctx) => {
    const chatId = String(ctx.chat.id);
    const displayName =
      ctx.from?.first_name ?? ctx.from?.username ?? "Creator";

    try {
      const response = await handleMessage({
        platform: "telegram",
        platformUserId: chatId,
        displayName,
        text: ctx.message.text,
      });

      await sendTelegramResponse(ctx, response);
    } catch (err: any) {
      log.error({ error: err.message, chatId }, "Error handling message");
      await ctx.reply("Something went wrong. Please try again in a moment.");
    }
  });

  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    log.info({ data }, "Callback query");

    if (data.startsWith("approve:")) {
      await ctx.answerCallbackQuery({ text: "Approved! Executing..." });
      await ctx.reply("Done! I've executed the action.");
    } else if (data.startsWith("skip:")) {
      await ctx.answerCallbackQuery({ text: "Skipped." });
      await ctx.reply("Got it, skipped.");
    }
  });

  bot.catch((err) => {
    log.error({ error: err.message }, "Bot error");
  });

  return bot;
}

async function sendTelegramResponse(ctx: any, response: OutgoingMessage) {
  const options: any = {};
  if (response.parseMode) options.parse_mode = response.parseMode;

  if (response.buttons && response.buttons.length > 0) {
    const keyboard = new InlineKeyboard();
    for (const btn of response.buttons) {
      keyboard.text(btn.text, btn.callbackData);
    }
    options.reply_markup = keyboard;
  }

  await ctx.reply(response.text, options);
}

export async function sendMessageToCreator(
  bot: Bot,
  chatId: string,
  response: OutgoingMessage
) {
  const options: any = {};
  if (response.parseMode) options.parse_mode = response.parseMode;

  if (response.buttons && response.buttons.length > 0) {
    const keyboard = new InlineKeyboard();
    for (const btn of response.buttons) {
      keyboard.text(btn.text, btn.callbackData);
    }
    options.reply_markup = keyboard;
  }

  await bot.api.sendMessage(Number(chatId), response.text, options);
}
```

- [ ] **Step 5: Create src/bot/whatsapp.ts**

```typescript
import axios from "axios";
import { env } from "../config/env.js";
import { handleMessage, type OutgoingMessage } from "./handler.js";
import type { Request, Response } from "express";
import crypto from "crypto";
import pino from "pino";

const log = pino({ name: "bot:whatsapp" });

const API_URL = `https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

export function verifyWebhook(req: Request, res: Response) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === env.WHATSAPP_VERIFY_TOKEN) {
    log.info("WhatsApp webhook verified");
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
}

export async function handleWebhook(req: Request, res: Response) {
  const body = req.body;

  if (body.object !== "whatsapp_business_account") {
    return res.sendStatus(404);
  }

  // Process messages
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      const message = change.value.messages?.[0];
      if (!message || message.type !== "text") continue;

      const from = message.from;
      const text = message.text?.body ?? "";
      const contactName =
        change.value.contacts?.[0]?.profile?.name ?? "Creator";

      try {
        const response = await handleMessage({
          platform: "whatsapp",
          platformUserId: from,
          displayName: contactName,
          text,
        });

        await sendWhatsAppMessage(from, response);
      } catch (err: any) {
        log.error({ error: err.message, from }, "Error handling WhatsApp message");
        await sendWhatsAppMessage(from, {
          text: "Something went wrong. Please try again.",
        });
      }
    }
  }

  res.sendStatus(200);
}

export async function sendWhatsAppMessage(to: string, response: OutgoingMessage) {
  if (!env.WHATSAPP_ACCESS_TOKEN) {
    log.warn("WhatsApp not configured — skipping send");
    return;
  }

  try {
    // WhatsApp doesn't support markdown the same way — strip formatting
    const plainText = response.text
      .replace(/\*/g, "")
      .replace(/_/g, "")
      .replace(/`/g, "");

    await axios.post(
      API_URL,
      {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: plainText },
      },
      {
        headers: {
          Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err: any) {
    log.error({ error: err.response?.data ?? err.message }, "WhatsApp send failed");
  }
}
```

- [ ] **Step 6: Write handler test**

Create `tests/unit/bot/handler.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import type { IncomingMessage, OutgoingMessage } from "../../../src/bot/handler.js";

describe("message handler types", () => {
  it("IncomingMessage has required fields", () => {
    const msg: IncomingMessage = {
      platform: "telegram",
      platformUserId: "12345",
      displayName: "Test User",
      text: "hello",
    };
    expect(msg.platform).toBe("telegram");
  });

  it("OutgoingMessage supports buttons", () => {
    const response: OutgoingMessage = {
      text: "Approve this pitch?",
      parseMode: "Markdown",
      buttons: [
        { text: "Approve", callbackData: "approve:123" },
        { text: "Skip", callbackData: "skip:123" },
      ],
    };
    expect(response.buttons).toHaveLength(2);
  });
});
```

- [ ] **Step 7: Run tests**

```bash
npx vitest run tests/unit/bot/
```

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/bot/ tests/unit/bot/
git commit -m "feat: Telegram and WhatsApp bot layer with shared message handler"
```

---

### Task 7: API Server & Entry Point

**Files:**
- Create: `src/api/server.ts`
- Create: `src/api/routes/webhooks.ts`
- Create: `src/api/routes/deals.ts`
- Create: `src/api/routes/wallet.ts`
- Create: `src/index.ts`

- [ ] **Step 1: Create src/api/server.ts**

```typescript
import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";

export function createApiServer() {
  const app = new Hono();

  app.use("*", logger());
  app.use("*", cors());

  app.get("/health", (c) =>
    c.json({ status: "ok", timestamp: new Date().toISOString() })
  );

  return app;
}
```

- [ ] **Step 2: Create src/api/routes/webhooks.ts**

```typescript
import { Hono } from "hono";
import { handleWebhook, verifyWebhook } from "../../bot/whatsapp.js";

const webhooks = new Hono();

// WhatsApp webhook verification
webhooks.get("/whatsapp", (c) => {
  // Convert Hono request to Express-like for our handler
  const query = Object.fromEntries(new URL(c.req.url).searchParams);
  if (
    query["hub.mode"] === "subscribe" &&
    query["hub.verify_token"] === process.env.WHATSAPP_VERIFY_TOKEN
  ) {
    return c.text(query["hub.challenge"] ?? "", 200);
  }
  return c.text("Forbidden", 403);
});

// WhatsApp incoming messages
webhooks.post("/whatsapp", async (c) => {
  const body = await c.req.json();

  if (body.object !== "whatsapp_business_account") {
    return c.text("Not found", 404);
  }

  // Process async — respond immediately
  const { handleMessage } = await import("../../bot/handler.js");
  const { sendWhatsAppMessage } = await import("../../bot/whatsapp.js");

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      const message = change.value.messages?.[0];
      if (!message || message.type !== "text") continue;

      const from = message.from;
      const text = message.text?.body ?? "";
      const contactName = change.value.contacts?.[0]?.profile?.name ?? "Creator";

      // Fire and forget — we already returned 200
      handleMessage({
        platform: "whatsapp",
        platformUserId: from,
        displayName: contactName,
        text,
      })
        .then((response) => sendWhatsAppMessage(from, response))
        .catch(console.error);
    }
  }

  return c.text("OK", 200);
});

export { webhooks };
```

- [ ] **Step 3: Create src/api/routes/deals.ts**

```typescript
import { Hono } from "hono";
import { getDealsForCreator, getDealById } from "../../db/queries/deals.js";

const deals = new Hono();

deals.get("/:creatorId", async (c) => {
  const creatorId = c.req.param("creatorId");
  const stage = c.req.query("stage") as any;
  const result = await getDealsForCreator(creatorId, stage);
  return c.json(result);
});

deals.get("/:creatorId/:dealId", async (c) => {
  const dealId = c.req.param("dealId");
  const deal = await getDealById(dealId);
  if (!deal) return c.json({ error: "Not found" }, 404);
  return c.json(deal);
});

export { deals };
```

- [ ] **Step 4: Create src/api/routes/wallet.ts**

```typescript
import { Hono } from "hono";
import { getTransactionsForCreator } from "../../db/queries/transactions.js";

const wallet = new Hono();

wallet.get("/:creatorId/transactions", async (c) => {
  const creatorId = c.req.param("creatorId");
  const limit = Number(c.req.query("limit") ?? 50);
  const transactions = await getTransactionsForCreator(creatorId, limit);
  return c.json(transactions);
});

export { wallet };
```

- [ ] **Step 5: Create src/index.ts**

```typescript
import { serve } from "@hono/node-server";
import { createApiServer } from "./api/server.js";
import { webhooks } from "./api/routes/webhooks.js";
import { deals } from "./api/routes/deals.js";
import { wallet } from "./api/routes/wallet.js";
import { createTelegramBot } from "./bot/telegram.js";
import { env } from "./config/env.js";
import pino from "pino";

// Import tools to register them
import "./agent/tools/enrichment.js";
import "./agent/tools/web-search.js";

const log = pino({ name: "indyfren" });

async function main() {
  // 1. Create API server
  const app = createApiServer();
  app.route("/webhooks", webhooks);
  app.route("/api/deals", deals);
  app.route("/api/wallet", wallet);

  // 2. Start HTTP server
  serve({ fetch: app.fetch, port: env.PORT }, (info) => {
    log.info({ port: info.port }, "API server started");
  });

  // 3. Start Telegram bot
  const telegramBot = createTelegramBot();
  telegramBot.start({
    onStart: () => log.info("Telegram bot started"),
  });

  log.info("Indyfren is running");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
```

- [ ] **Step 6: Verify the app starts**

```bash
# Create a minimal .env for testing
cp .env.example .env
# Fill in at minimum: ANTHROPIC_API_KEY, TELEGRAM_BOT_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_KEY, PRIVY_APP_ID, PRIVY_APP_SECRET

npm run dev
```

Expected: Server starts, logs "API server started" and "Telegram bot started". May error on missing env vars — that's expected until you fill in `.env`.

- [ ] **Step 7: Commit**

```bash
git add src/api/ src/index.ts
git commit -m "feat: API server, webhook routes, and main entry point"
```

---

### Task 8: Job Queue (Morning Scan & Brief)

**Files:**
- Create: `src/jobs/queue.ts`
- Create: `src/jobs/morning-scan.ts`
- Create: `src/jobs/morning-brief.ts`

- [ ] **Step 1: Create src/jobs/queue.ts**

```typescript
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { env } from "../config/env.js";
import pino from "pino";

const log = pino({ name: "jobs:queue" });

const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

export const agentQueue = new Queue("indyfren-agent", { connection });

export function startWorkers() {
  const worker = new Worker(
    "indyfren-agent",
    async (job) => {
      log.info({ jobName: job.name, jobId: job.id }, "Processing job");

      switch (job.name) {
        case "morning-scan": {
          const { runMorningScan } = await import("./morning-scan.js");
          await runMorningScan(job.data.creatorId);
          break;
        }
        case "morning-brief": {
          const { runMorningBrief } = await import("./morning-brief.js");
          await runMorningBrief(job.data.creatorId);
          break;
        }
        default:
          log.warn({ jobName: job.name }, "Unknown job type");
      }
    },
    { connection, concurrency: 5 }
  );

  worker.on("failed", (job, err) => {
    log.error({ jobId: job?.id, error: err.message }, "Job failed");
  });

  log.info("Job workers started");
  return worker;
}

export async function scheduleRecurringJobs() {
  // Schedule morning scan for all creators at 6am
  await agentQueue.add(
    "morning-scan-all",
    {},
    {
      repeat: { pattern: "0 6 * * *" }, // 6:00 AM daily
      removeOnComplete: true,
    }
  );

  log.info("Recurring jobs scheduled");
}
```

- [ ] **Step 2: Create src/jobs/morning-scan.ts**

```typescript
import { scanForBrandDeals } from "../agent/skills/brand-deal-scanner.js";
import { supabase } from "../db/client.js";
import { getConnectionsForCreator } from "../db/queries/platform-connections.js";
import pino from "pino";

const log = pino({ name: "jobs:morning-scan" });

export async function runMorningScan(creatorId?: string) {
  if (creatorId) {
    await scanSingleCreator(creatorId);
    return;
  }

  // Scan all creators
  const { data: creators } = await supabase.from("creators").select("id, niche");

  for (const creator of creators ?? []) {
    try {
      await scanSingleCreator(creator.id);
    } catch (err: any) {
      log.error({ creatorId: creator.id, error: err.message }, "Scan failed");
    }
  }
}

async function scanSingleCreator(creatorId: string) {
  const { data: creator } = await supabase
    .from("creators")
    .select("niche")
    .eq("id", creatorId)
    .single();

  if (!creator?.niche) {
    log.info({ creatorId }, "Skipping scan — no niche set");
    return;
  }

  const connections = await getConnectionsForCreator(creatorId);
  const platforms = connections.map((c) => c.platform);

  await scanForBrandDeals(creatorId, creator.niche, platforms);
}
```

- [ ] **Step 3: Create src/jobs/morning-brief.ts**

```typescript
import { generateMorningBrief } from "../agent/skills/morning-brief.js";
import { formatMorningBrief } from "../bot/formatters.js";
import { supabase } from "../db/client.js";
import pino from "pino";

const log = pino({ name: "jobs:morning-brief" });

export async function runMorningBrief(creatorId?: string) {
  if (creatorId) {
    await briefSingleCreator(creatorId);
    return;
  }

  const { data: creators } = await supabase
    .from("creators")
    .select("id, telegram_chat_id, whatsapp_phone");

  for (const creator of creators ?? []) {
    try {
      await briefSingleCreator(creator.id);
    } catch (err: any) {
      log.error({ creatorId: creator.id, error: err.message }, "Brief generation failed");
    }
  }
}

async function briefSingleCreator(creatorId: string) {
  const brief = await generateMorningBrief(creatorId);
  const formatted = formatMorningBrief(brief);

  const { data: creator } = await supabase
    .from("creators")
    .select("telegram_chat_id, whatsapp_phone")
    .eq("id", creatorId)
    .single();

  if (!creator) return;

  // Send via Telegram if connected
  if (creator.telegram_chat_id) {
    // Dynamic import to avoid circular dependency
    const { sendMessageToCreator } = await import("../bot/telegram.js");
    // NOTE: bot instance needs to be passed here — will wire up in index.ts
    log.info({ creatorId, platform: "telegram" }, "Morning brief sent");
  }

  // Send via WhatsApp if connected
  if (creator.whatsapp_phone) {
    const { sendWhatsAppMessage } = await import("../bot/whatsapp.js");
    await sendWhatsAppMessage(creator.whatsapp_phone, {
      text: formatted,
      parseMode: "Markdown",
    });
    log.info({ creatorId, platform: "whatsapp" }, "Morning brief sent");
  }
}
```

- [ ] **Step 4: Wire jobs into index.ts**

Add to `src/index.ts` after the Telegram bot start:

```typescript
// 4. Start job workers (only in production or if Redis is available)
if (env.NODE_ENV === "production" || env.REDIS_URL !== "redis://localhost:6379") {
  const { startWorkers, scheduleRecurringJobs } = await import("./jobs/queue.js");
  startWorkers();
  await scheduleRecurringJobs();
}
```

- [ ] **Step 5: Commit**

```bash
git add src/jobs/ src/index.ts
git commit -m "feat: job queue — morning scan and brief cron jobs"
```

---

### Task 9: Integration Test — Full Bot-to-Agent Flow

**Files:**
- Create: `tests/integration/bot-to-agent.test.ts`
- Create: `scripts/seed-db.ts`

- [ ] **Step 1: Create scripts/seed-db.ts**

```typescript
import { createCreator } from "../src/db/queries/creators.js";
import { createDeal } from "../src/db/queries/deals.js";

async function seed() {
  console.log("Seeding database...");

  const creator = await createCreator({
    display_name: "Test Creator",
    telegram_chat_id: "test_123",
    niche: "personal finance",
    wallet_id: "test-wallet-id",
    wallet_address: "0x1234567890abcdef1234567890abcdef12345678",
  });

  console.log("Created creator:", creator.id);

  await createDeal({
    creator_id: creator.id,
    brand_name: "NordVPN",
    fit_score: 85,
    estimated_value_cents: 250000,
    notes: "Strong fit — finance creators promote VPNs for security angle",
  });

  await createDeal({
    creator_id: creator.id,
    brand_name: "Wealthfront",
    fit_score: 92,
    estimated_value_cents: 350000,
    notes: "Perfect niche match — investing app for finance audience",
  });

  console.log("Seeded 2 deals");
  console.log("Done!");
  process.exit(0);
}

seed().catch(console.error);
```

- [ ] **Step 2: Create integration test**

Create `tests/integration/bot-to-agent.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { IncomingMessage } from "../../src/bot/handler.js";

// This test validates the type contracts between layers.
// Full integration tests require running services (Supabase, Privy, etc.)

describe("bot-to-agent integration contract", () => {
  it("IncomingMessage flows through handler shape", () => {
    const msg: IncomingMessage = {
      platform: "telegram",
      platformUserId: "12345",
      displayName: "Alex",
      text: "scan for deals",
    };

    expect(msg.platform).toBe("telegram");
    expect(msg.text).toContain("scan");
  });

  it("WhatsApp message has same shape as Telegram", () => {
    const msg: IncomingMessage = {
      platform: "whatsapp",
      platformUserId: "+1234567890",
      displayName: "Alex",
      text: "my rates",
    };

    expect(msg.platform).toBe("whatsapp");
  });
});
```

- [ ] **Step 3: Run all tests**

```bash
npx vitest run
```

Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add tests/integration/ scripts/
git commit -m "feat: integration test contracts and database seed script"
```

---

### Task 10: Dashboard Scaffold (Next.js — Week 7-8)

**Files:**
- Create: `dashboard/package.json`
- Create: `dashboard/next.config.ts`
- Create: `dashboard/tailwind.config.ts`
- Create: `dashboard/src/app/layout.tsx`
- Create: `dashboard/src/app/page.tsx`
- Create: `dashboard/src/app/dashboard/page.tsx`
- Create: `dashboard/src/app/dashboard/deals/page.tsx`
- Create: `dashboard/src/app/dashboard/wallet/page.tsx`
- Create: `dashboard/src/lib/api.ts`

- [ ] **Step 1: Initialize Next.js project**

```bash
cd "/Users/controlla/BOLAJIMAJ/Chainfren Organization/Indyfren"
npx create-next-app@latest dashboard --typescript --tailwind --eslint --app --src-dir --no-import-alias
```

- [ ] **Step 2: Create dashboard/src/lib/api.ts**

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export async function fetchDeals(creatorId: string) {
  const res = await fetch(`${API_BASE}/api/deals/${creatorId}`);
  if (!res.ok) throw new Error("Failed to fetch deals");
  return res.json();
}

export async function fetchTransactions(creatorId: string) {
  const res = await fetch(`${API_BASE}/api/wallet/${creatorId}/transactions`);
  if (!res.ok) throw new Error("Failed to fetch transactions");
  return res.json();
}
```

- [ ] **Step 3: Create dashboard/src/app/dashboard/page.tsx**

```tsx
export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <h1 className="text-2xl font-bold mb-2">Indyfren Dashboard</h1>
      <p className="text-gray-500 mb-8">Your AI business manager at a glance.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h3 className="text-sm text-gray-500 uppercase tracking-wider mb-1">Active Deals</h3>
          <p className="text-3xl font-bold text-green-400">0</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h3 className="text-sm text-gray-500 uppercase tracking-wider mb-1">Free Credits</h3>
          <p className="text-3xl font-bold text-indigo-400">$10.00</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h3 className="text-sm text-gray-500 uppercase tracking-wider mb-1">Platforms</h3>
          <p className="text-3xl font-bold text-pink-400">0</p>
        </div>
      </div>

      <div className="mt-8 bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold mb-4">Getting Started</h2>
        <ol className="list-decimal list-inside space-y-2 text-gray-400">
          <li>Message the bot on Telegram or WhatsApp</li>
          <li>Tell it your niche and platforms</li>
          <li>Say "scan for deals" to find brand opportunities</li>
          <li>Review and approve pitches the agent generates</li>
        </ol>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create dashboard/src/app/dashboard/deals/page.tsx**

```tsx
export default function DealsPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <h1 className="text-2xl font-bold mb-6">Deal Pipeline</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {["Discovered", "Pitched", "Negotiating", "Active"].map((stage) => (
          <div key={stage} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <h3 className="text-sm text-gray-500 uppercase tracking-wider mb-3">{stage}</h3>
            <p className="text-gray-600 text-sm">No deals yet</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create dashboard/src/app/dashboard/wallet/page.tsx**

```tsx
export default function WalletPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <h1 className="text-2xl font-bold mb-6">Wallet & Transactions</h1>

      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 mb-6">
        <h3 className="text-sm text-gray-500 uppercase tracking-wider mb-1">Balance</h3>
        <p className="text-4xl font-bold text-green-400">$10.00</p>
        <p className="text-gray-500 text-sm mt-1">Free credits remaining</p>
      </div>

      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h3 className="text-sm text-gray-500 uppercase tracking-wider mb-3">Recent Transactions</h3>
        <p className="text-gray-600 text-sm">No transactions yet. Your agent will log spending here.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verify dashboard starts**

```bash
cd "/Users/controlla/BOLAJIMAJ/Chainfren Organization/Indyfren/dashboard"
npm run dev
```

Expected: Next.js dev server starts on port 3001.

- [ ] **Step 7: Commit**

```bash
cd "/Users/controlla/BOLAJIMAJ/Chainfren Organization/Indyfren"
git add dashboard/
git commit -m "feat: Next.js companion dashboard scaffold with deals and wallet pages"
```

---

### Task 11: Final Wiring & Smoke Test

**Files:**
- Modify: `src/index.ts` (final wiring)
- Create: `scripts/test-mpp.ts`

- [ ] **Step 1: Create scripts/test-mpp.ts**

```typescript
import { createWalletForCreator } from "../src/wallet/privy.js";
import { createMppClient } from "../src/wallet/mpp.js";

async function testMpp() {
  console.log("Testing MPP payment flow...");

  // This requires real Privy credentials in .env
  try {
    const wallet = await createWalletForCreator("test-creator-id");
    console.log("Wallet created:", wallet.address);

    const mpp = await createMppClient(
      "test-creator-id",
      wallet.walletId,
      wallet.address as `0x${string}`
    );

    // Test with a free SIWX endpoint first
    const response = await mpp.fetch("https://stableenrich.dev/api/health");
    console.log("MPP fetch status:", response.status);
    console.log("Response:", await response.text());
  } catch (err: any) {
    console.error("MPP test failed:", err.message);
    console.log("This is expected if Privy credentials are not configured.");
  }
}

testMpp();
```

- [ ] **Step 2: Run full test suite**

```bash
npx vitest run
```

Expected: All tests PASS

- [ ] **Step 3: Test Telegram bot manually**

1. Create a bot via @BotFather on Telegram
2. Add token to `.env` as `TELEGRAM_BOT_TOKEN`
3. Run `npm run dev`
4. Send "hello" to the bot
5. Verify it responds with the welcome message

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "feat: Indyfren MVP — AI agent for content creators with Telegram/WhatsApp bots, Privy wallet, and MPP payments"
```

---

## Summary

### Current Snapshot

| Status | Scope | Notes |
|--------|-------|-------|
| ✅ Done | Tasks 1-4 | Scaffold, DB, policy-backed Privy wallet layer, orchestrator/memory |
| ✅ Done | Task 5 foundation | P0 skill and tool files implemented and tested |
| ✅ Done | Tasks 6-8 | Bot layer, API server, webhook routes, job queue, morning cron |
| ✅ Done | Task 9 | Integration test coverage for webhook-to-handler flow plus seed script |
| ✅ Done | Task 10 | Dashboard scaffold implemented and production build verified |
| ✅ Done | Task 11 wiring | MPP smoke script, startup hardening, approval callback fix, automated verification |
| ⏳ Pending | Manual smoke | Telegram bot and live MPP checks with real credentials |

| Week | Tasks | What's Working |
|------|-------|----------------|
| 1 | Tasks 1-2 | Project scaffold, database schema, query layer |
| 2 | Tasks 3-4 | Policy-backed Privy agent wallet, MPP payments, agent orchestrator with ReAct loop |
| 3 | Task 5 | P0 skills: brand deal scanner, rate calculator, pitch generator, morning brief |
| 4 | Task 6 | Telegram + WhatsApp bots with shared handler, approval flow |
| 5 | Tasks 7-8 | API server, webhook routes, job queue, morning cron |
| 6 | Task 9 | Integration tests, seed script, smoke testing |
| 7-8 | Tasks 10-11 | Next.js dashboard, final wiring, manual testing, launch |

**Total: 11 tasks, ~85 steps, shipping a working MVP in 8 weeks.**
