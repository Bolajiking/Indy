# Indyfren

[![CI/CD](https://github.com/your-org/indyfren/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/indyfren/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/tests-352%20passing-success)](./docs/TEST_RESULTS.md)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

AI business manager for independent content creators. Manages brand deals, rate negotiations, pitching, financial tracking, and content strategy through Telegram/WhatsApp chat and a companion web dashboard.

## 🚀 Quick Links

- **[Deployment Guide](docs/DEPLOYMENT.md)** - Production deployment to Railway & Vercel
- **[API Documentation](docs/API.md)** - Complete API reference
- **[Testing Guide](docs/TESTING_CHECKLIST.md)** - End-to-end testing checklist
- **[Test Results](docs/TEST_RESULTS.md)** - Latest test validation
- **[Wallet Funding](docs/WALLET_FUNDING.md)** - How to fund agent wallets

## 📊 Status

- ⚠️ **Public sandbox beta preparation; staging has not passed live smoke**
- ✅ Automated unit/build coverage for core backend and dashboard flows
- ✅ Core agent system operational
- ✅ Telegram + WhatsApp bots working
- ✅ Dashboard with Privy auth
- ⚠️ Wallet provisioning is wired, but paid MPP calls still require funded Tempo sandbox wallets
- ✅ `npm run verify` is the shared local/CI test, build, format, and audit contract
- ✅ Root moderate+ and dashboard high+ advisories are blocking gates
- ⚠️ Root retains one low-severity esbuild development-server advisory; dashboard retains two moderate findings for Next-bundled PostCSS
- ⏳ Additional platform OAuth (Instagram, TikTok, Twitter)

## Architecture

- **Backend**: Hono API server (port 3000) with a configurable AI-provider agent orchestrator
- **Dashboard**: Next.js 15 app (port 3001) with Privy auth
- **Bot transports**: Telegram (grammY) + WhatsApp (Meta Cloud API)
- **Database**: Supabase (PostgreSQL)
- **Payments**: MPP micropayments on Tempo Network via Privy server wallets
- **Jobs**: BullMQ + Redis for scheduled tasks (morning scan, briefs, reminders)

## Prerequisites

- Node.js 22.x
- Redis (for job queue)
- Supabase project
- Privy account (app ID + secret)
- AI provider API key (`ANTHROPIC_API_KEY` by default, or `AI_PROVIDER=openai` with `AI_API_KEY` / `OPENAI_API_KEY`)

## 🚀 Sandbox Deployment Setup

Railway and Vercel automation is configured, but that configuration is not a production-readiness claim. Promote only to the public sandbox beta after staging health, Privy auth, dashboard proxy, and a funded Tempo MPP smoke all pass with deployment credentials.

**Quick Deploy:**

1. Push to GitHub
2. GitHub Actions deploys to Railway (backend) and Vercel (dashboard) only after all blocking verification and security jobs pass
3. See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed instructions

**Required Setup:**

- Railway account for backend hosting
- Vercel account for dashboard hosting
- Configure GitHub Secrets (see [deployment guide](docs/DEPLOYMENT.md#github-secrets))

**Manual Deploy:**

```bash
# Backend (Railway)
railway login
railway init
railway up

# Dashboard (Vercel)
cd dashboard
vercel --prod
```

Full guide: **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**

## YouTube OAuth Setup

YouTube OAuth is shipped and lives in the dashboard settings flow. It is separate from Privy, which still handles creator identity and the agentic wallet.

Required env vars:

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `YOUTUBE_OAUTH_REDIRECT_URI`
- `DASHBOARD_APP_URL`
- `PRIVY_APP_ID` and `PRIVY_APP_SECRET` for signed dashboard auth and OAuth state checks
- `NEXT_PUBLIC_PRIVY_APP_ID` and `NEXT_PUBLIC_API_URL` in the dashboard runtime/build env when you run or build the Next app directly
- `SMOKE_PRIVY_ACCESS_TOKEN` only when you want to run the authenticated live smoke script against `/api/auth/me`

Callback expectation:

- Google must allow the exact redirect URI in `YOUTUBE_OAUTH_REDIRECT_URI`.
- For local dev, the callback is `http://localhost:3000/api/platforms/oauth/youtube/callback`.
- After the callback completes, the API redirects back to `DASHBOARD_APP_URL` with an `oauth=success|error` query string.
- If Google returns `error=access_denied`, the API now redirects back with `oauth=error&error=provider_access_denied`.
- `DASHBOARD_APP_URL` should point at the dashboard origin that users sign into with Privy.
- Outside local development, `DASHBOARD_APP_URL` is mandatory. Leaving it at the localhost default will send OAuth callbacks back to `http://localhost:3001`.

Boundary note:

- Privy authenticates the creator and gates dashboard access.
- YouTube OAuth only connects a platform account and stores encrypted platform credentials.
- Other connected-platform providers still use the manual path for now.

## Setup

### 1. Environment

```bash
cp .env.example .env
# Fill in all required values: AI provider key, SUPABASE_URL, SUPABASE_SERVICE_KEY, PRIVY_APP_ID, PRIVY_APP_SECRET
```

If you start or build the dashboard from `dashboard/` directly, also provide its public envs in that process. The simplest local option is `dashboard/.env.local` with at least:

```bash
NEXT_PUBLIC_PRIVY_APP_ID=...
NEXT_PUBLIC_API_URL=http://localhost:3000
```

The root `.env` helps when you launch everything from the workspace, but it is not a substitute for the dashboard's own build/runtime env in every deployment setup.

### 2. Database

Run the schema in your Supabase SQL Editor, or use the init script:

```bash
npm run db:init    # Prints the SQL and checks table existence
npm run db:seed    # Seeds demo data (2 creators, 7 deals, transactions, etc.)
```

### 3. Install & Build

```bash
npm install
npm run build

cd dashboard && npm install && npm run build && cd ..
```

### 4. Run

```bash
# Both backend + dashboard
npm run dev:all

# Or separately
npm run dev              # Backend on :3000
npm run dashboard:dev    # Dashboard on :3001
```

### 5. Docker (production)

```bash
docker-compose up --build
```

## Manual Verification

Use this checklist to validate the shipped YouTube OAuth slice end to end:

1. Start the backend and dashboard together with `npm run dev:all`, or run `npm run dev` and `npm run dashboard:dev` separately.
2. Sign into the dashboard with Privy and confirm you reach an active or wallet-pending creator session.
3. Open `Settings`, then use the YouTube row in `Connected platforms` to start the Google OAuth flow.
4. Finish consent, then confirm you land back on `/dashboard/settings` with a success message and YouTube marked `Connected`.
5. Verify the dashboard still treats Privy as the creator identity layer and YouTube as a connected-platform flow, not a wallet feature.
6. Failure-path checks:
   - Tampered or expired OAuth state should redirect back with an OAuth error message instead of saving a connection.
   - Denied consent should return you to settings with `error=provider_access_denied` and no stored YouTube connection.
   - Missing `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, or `YOUTUBE_OAUTH_REDIRECT_URI` should leave YouTube OAuth unavailable; verify all three together because partial config no longer starts the flow.
   - `DASHBOARD_APP_URL` controls the post-consent redirect target, so verify it separately from the Google callback URL before rollout.
   - When the dashboard is built or run directly, make sure its own env includes `NEXT_PUBLIC_PRIVY_APP_ID` and `NEXT_PUBLIC_API_URL` or the settings flow will not boot correctly even if the root `.env` is populated.

## Live Readiness and Auth Smoke

Use these commands when you want to validate the live Privy-backed auth path before doing a full dashboard walkthrough:

```bash
npm run smoke:preflight
node --import tsx scripts/smoke-health.ts
npm run smoke:auth
npm run test:mpp
```

`npm run smoke:auth` checks the authenticated `GET /api/auth/me` flow with a real bearer token. It requires:

- `SMOKE_PRIVY_ACCESS_TOKEN` set to a real Privy access token from a signed-in dashboard session
- backend API running on `SMOKE_API_URL` or `NEXT_PUBLIC_API_URL` or the default `http://localhost:3000`

Optional:

- Set `SMOKE_CHECK_DASHBOARD_PROXY=true` to also verify the dashboard proxy at `/api/proxy/api/auth/me`
- Use `SMOKE_DASHBOARD_URL` to override the dashboard origin for that proxy check
- Set `SMOKE_REQUIRE_DASHBOARD=true` for `scripts/smoke-health.ts` when dashboard health must be part of the gate
- Set `MPP_TEST_CREATOR_ID` to a real Privy-backed creator with a funded Tempo testnet wallet before running `npm run test:mpp`
- Set `MPP_SMOKE_ALLOW_UNFUNDED=true` only for sandbox diagnostics where an `InsufficientBalance` result is expected and should not block local investigation

This is useful for separating operator issues:

- If `smoke:preflight` fails, env or DNS is still incomplete.
- If `scripts/smoke-health.ts` fails, the backend readiness route or dashboard runtime is not healthy.
- If `smoke:auth` fails on the direct API call, bearer auth or backend config is the issue.
- If the direct API call passes but the proxy check fails, the dashboard/runtime wiring is the issue.
- If `test:mpp` fails with `InsufficientBalance`, wallet provisioning reached Tempo but the creator wallet needs pathUSD funding before paid requests can settle.

MPP payment attempts are now recorded in the `payment_attempts` ledger before settlement. The ledger tracks the service URL/host, challenge and credential stages, quoted and actual cents, receipt reference, linked transaction, and failure text, so failed paid calls are observable instead of disappearing into logs.

If a live MPP smoke reports that `payment_attempts` is missing, set `DATABASE_URL` to a working Supabase direct or pooler Postgres URL and run `npm run db:migrate:payment-attempts`.

## Scripts

| Script                                      | Description                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------- |
| `npm run dev`                               | Start backend with hot reload                                                   |
| `npm run dev:all`                           | Start backend + dashboard together                                              |
| `npm run build`                             | TypeScript compile                                                              |
| `npm test`                                  | Run all tests                                                                   |
| `npm run verify`                            | Run the shared test, build, format, and audit contract                          |
| `npm run db:init`                           | Print/verify database schema                                                    |
| `npm run db:migrate:payment-attempts`       | Apply the MPP payment-attempt ledger table/index/RLS slice                      |
| `npm run db:seed`                           | Seed demo data                                                                  |
| `npm run smoke:preflight`                   | Check env vars and DNS                                                          |
| `node --import tsx scripts/smoke-health.ts` | Validate API `/health`, `/health/ready`, and optional dashboard health          |
| `npm run smoke:auth`                        | Validate Privy bearer auth on `/api/auth/me` and optionally the dashboard proxy |
| `npm run test:mpp`                          | Validate a live funded Tempo MPP paid ping                                      |
| `npm run dashboard:dev`                     | Start dashboard dev server                                                      |
| `npm run dashboard:build`                   | Production build dashboard                                                      |

## API Endpoints

| Route                          | Description                                 |
| ------------------------------ | ------------------------------------------- |
| `GET /health`                  | Health check with dependency status         |
| `GET /health/ready`            | Readiness probe                             |
| `POST /webhooks/telegram`      | Telegram webhook                            |
| `GET/POST /webhooks/whatsapp`  | WhatsApp webhook                            |
| `POST /api/auth/register`      | Creator registration                        |
| `GET /api/auth/me`             | Current creator profile                     |
| `GET /api/deals`               | List deals                                  |
| `GET /api/wallet/transactions` | Wallet activity                             |
| `GET /api/platforms`           | Connected platforms                         |
| `GET /api/reports/*`           | Financial, analytics, calendar, SEO reports |

## Bot Commands

Send these via Telegram or WhatsApp:

- `scan for deals` — Find brand opportunities
- `my rates` — View rate card
- `my deals` — Check deal pipeline
- `wallet` — Check balance
- `brief` — Morning brief
- `calendar` — Upcoming deadlines
- `finances` — Financial snapshot
- `content plan` — Weekly content strategy

## Testing

```bash
npm run verify
```

Current local baseline: 77 test files and 352 tests pass. This is automated verification only; staging and live-smoke gates remain outstanding.
