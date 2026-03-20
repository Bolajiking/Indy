# End-to-End Testing Checklist

**Last Updated:** 2026-03-20

## Pre-Testing Setup

### Environment Variables
- [ ] `.env` file configured with all required vars
- [ ] `ANTHROPIC_API_KEY` set and valid
- [ ] `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` set
- [ ] `PRIVY_APP_ID` and `PRIVY_APP_SECRET` set
- [ ] `REDIS_URL` pointing to running Redis instance
- [ ] Dashboard `.env.local` configured (if running separately)

### Services Running
- [ ] Redis running (`docker run -d -p 6379:6379 redis:7-alpine` or local)
- [ ] Supabase database accessible
- [ ] Schema initialized (`npm run db:init`)

### Optional (for full testing)
- [ ] `TELEGRAM_BOT_TOKEN` set (for Telegram tests)
- [ ] `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` set (for WhatsApp tests)
- [ ] `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` set (for YouTube OAuth)

---

## 1. Backend API Tests

### Health Checks
- [ ] Start backend: `npm run dev`
- [ ] `curl http://localhost:3000/health` returns 200 with status "ok"
- [ ] `curl http://localhost:3000/health/ready` returns 200
- [ ] Health response includes uptime and dependencies

### Database Connection
- [ ] Health check shows `"database": "ok"`
- [ ] Can query Supabase from backend
- [ ] No connection errors in logs

### Redis Connection
- [ ] Health check shows `"redis": "ok"` (or skipped if jobs disabled)
- [ ] Job queue can connect
- [ ] No Redis errors in logs

---

## 2. Authentication Flow

### Privy Token Verification
- [ ] Get fresh Privy token from dashboard sign-in
- [ ] Update `SMOKE_PRIVY_ACCESS_TOKEN` in `.env.local`
- [ ] Run `npm run smoke:auth`
- [ ] Smoke test passes with 200 response
- [ ] `/api/auth/me` returns creator profile

### Creator Registration
- [ ] Sign in to dashboard with NEW Privy account
- [ ] Registration form appears for unregistered user
- [ ] Submit registration with display name and niche
- [ ] Creator profile created successfully
- [ ] Wallet provisioning starts (status: "wallet_pending" or "active")

### Creator Profile Access
- [ ] `GET /api/auth/me` returns correct creator data
- [ ] Creator ID matches database
- [ ] Privy user ID is stored
- [ ] Wallet address shown (if provisioned)

---

## 3. Dashboard Tests

### Authentication States
- [ ] Start dashboard: `npm run dashboard:dev`
- [ ] Visit `http://localhost:3001`
- [ ] Sign in with Privy (Google, Email, or Wallet)
- [ ] Dashboard loads after authentication
- [ ] Creator profile syncs from backend

### Dashboard Pages
- [ ] **Overview** (`/dashboard`) - Loads with deals and metrics
- [ ] **Deals** (`/dashboard/deals`) - Shows deal pipeline
- [ ] **Wallet** (`/dashboard/wallet`) - Shows transactions
- [ ] **Reports** (`/dashboard/reports`) - Shows financial/analytics data
- [ ] **Settings** (`/dashboard/settings`) - Shows profile and platform connections

### Wallet Page Specific
- [ ] Funding banner shows if no transactions
- [ ] Wallet address displayed correctly
- [ ] Transaction list loads (or shows empty state)
- [ ] "Get Testnet Funds" link works

### Settings Page Specific
- [ ] Profile form loads with current data
- [ ] Can update display name
- [ ] Can update niche
- [ ] Platform connections section shows
- [ ] YouTube OAuth button appears (if configured)

---

## 4. Agent Orchestrator Tests

### Agent Invocation
- [ ] Create test creator in DB or use existing
- [ ] Call agent via bot handler or direct API
- [ ] Agent responds with text
- [ ] No LLM errors in logs
- [ ] Claude API calls succeed

### Tool Execution
- [ ] Agent can call autonomous tools (web_search, enrichment)
- [ ] Tool results returned to agent
- [ ] Agent incorporates tool results in response
- [ ] Credit deduction happens for paid tools

### Hybrid Tools (Approval Flow)
- [ ] Agent requests approval for hybrid tools (e.g., send_email)
- [ ] Approval request returned to user
- [ ] Approval action stored in database
- [ ] Can approve/skip via bot buttons (if Telegram configured)

### Memory & Context
- [ ] Agent maintains conversation history
- [ ] Context assembled from creator profile
- [ ] Recent messages included in prompts
- [ ] No memory leaks or context overflow

---

## 5. Telegram Bot Tests

**Note:** Requires `TELEGRAM_BOT_TOKEN` and network access

### Bot Startup
- [ ] Bot starts successfully (long-polling mode)
- [ ] No errors in startup logs
- [ ] Bot responds to `/start` command

### New User Onboarding
- [ ] Send "Hello" from new Telegram account
- [ ] Bot creates creator profile
- [ ] Receives onboarding message
- [ ] Wallet provisioning triggered in background

### Commands
- [ ] `scan for deals` - Agent scans and responds
- [ ] `calendar` - Shows upcoming deadlines
- [ ] `finances` - Shows financial snapshot
- [ ] `wallet` - Shows wallet info
- [ ] `content plan` - Shows content strategy
- [ ] `my deals` - Shows deal pipeline

### Message Splitting
- [ ] Long agent responses split correctly (<4096 chars)
- [ ] All message chunks delivered
- [ ] Formatting preserved across chunks

### Approval Buttons
- [ ] Agent requests approval
- [ ] Inline keyboard buttons appear
- [ ] Click "Approve" - action executes
- [ ] Click "Skip" - action cancelled
- [ ] Button state updates after click

---

## 6. WhatsApp Bot Tests

**Note:** Requires WhatsApp Business API setup

### Webhook Verification
- [ ] `GET /webhooks/whatsapp` with correct verify_token returns challenge
- [ ] Incorrect verify_token returns 403

### Message Receiving
- [ ] Send message to WhatsApp bot number
- [ ] Webhook receives message
- [ ] Signature verification passes
- [ ] Message routed to handler
- [ ] Creator profile created/found

### Message Sending
- [ ] Bot sends response message
- [ ] Response delivered to WhatsApp
- [ ] No send errors in logs
- [ ] Message content correct (Markdown stripped)

---

## 7. Platform Integration Tests

### YouTube OAuth
- [ ] Click "Connect YouTube" in dashboard settings
- [ ] Redirected to Google OAuth
- [ ] Complete consent flow
- [ ] Redirected back with `oauth=success`
- [ ] YouTube shows as "Connected"
- [ ] Channel username displayed
- [ ] Access token encrypted in database

### Manual Platform Connection
- [ ] Use manual token entry form
- [ ] Enter platform credentials
- [ ] Connection saved successfully
- [ ] Shows in connected platforms list

### Platform Disconnect
- [ ] Click disconnect on connected platform
- [ ] Confirmation (if implemented)
- [ ] Platform removed from list
- [ ] Access token deleted from database

---

## 8. Wallet & Transaction Tests

### Wallet Provisioning
- [ ] New creator triggers provisioning
- [ ] Privy creates server wallet
- [ ] Policy created with spending limits
- [ ] Wallet ID and address saved
- [ ] Onboarding status updates to "active"

### Wallet Retry
- [ ] Force wallet provisioning failure (disconnect network)
- [ ] Status shows "wallet_pending"
- [ ] Click "Retry Wallet Setup" in dashboard
- [ ] Provisioning retries successfully
- [ ] Status updates to "active"

### Credit Deduction
- [ ] Creator has free credits
- [ ] Agent uses paid tool
- [ ] Credits deducted from balance
- [ ] Transaction recorded
- [ ] Credit balance updates correctly

### Spending Limits
- [ ] Set per-transaction limit to $0.50
- [ ] Try tool that costs $1.00
- [ ] Tool call blocked
- [ ] Error message shown
- [ ] No charge occurs

---

## 9. Jobs & Automation Tests

### Job Queue
- [ ] Jobs system enabled (`ENABLE_JOBS=true`)
- [ ] Redis connection established
- [ ] Workers start successfully
- [ ] No queue errors in logs

### Morning Scan
- [ ] Job scheduled for 6:00 AM
- [ ] OR trigger manually: `bullmq run morning-scan`
- [ ] Job executes for creators with niche
- [ ] Brand deals discovered
- [ ] Deals saved to database

### Morning Brief
- [ ] Job scheduled for 7:00 AM
- [ ] OR trigger manually
- [ ] Brief generated for each creator
- [ ] Sent via Telegram/WhatsApp
- [ ] Brief includes deals, calendar, finances

### Invoice Reminders
- [ ] Create overdue invoice
- [ ] Job triggers on Monday 10 AM
- [ ] Reminder sent via bot
- [ ] Correct invoice referenced

---

## 10. API Route Tests

### Deals API
- [ ] `GET /api/deals` returns creator's deals
- [ ] `POST /api/deals` creates new deal
- [ ] `PATCH /api/deals/:id` updates deal
- [ ] Unauthorized access blocked (401)

### Platforms API
- [ ] `GET /api/platforms` returns connections
- [ ] `POST /api/platforms/connect` saves manual connection
- [ ] `DELETE /api/platforms/:platform` removes connection
- [ ] OAuth routes work (tested above)

### Wallet API
- [ ] `GET /api/wallet/transactions` returns transactions
- [ ] Pagination works (`?limit=10`)
- [ ] Filtered by creator correctly

### Reports API
- [ ] `GET /api/reports/financial` returns snapshot
- [ ] `GET /api/reports/analytics` aggregates platform data
- [ ] `GET /api/reports/calendar` shows deadlines
- [ ] Data accurate for creator

---

## 11. Error Handling Tests

### Invalid Auth
- [ ] Request without token returns 401
- [ ] Invalid/expired token returns 401
- [ ] Wrong creator's data blocked

### Invalid Input
- [ ] Malformed JSON returns 400
- [ ] Missing required fields returns 400
- [ ] Invalid deal stage returns 400

### Rate Limiting
- [ ] Rapid requests trigger rate limit
- [ ] 429 status returned
- [ ] Retry-After header included

### Service Failures
- [ ] Database down - graceful error
- [ ] Redis down - jobs disabled but API works
- [ ] Claude API down - error returned to user
- [ ] No crashes or panics

---

## 12. Integration Tests (Automated)

### Test Suite
- [ ] Run `npm test`
- [ ] All test files pass
- [ ] No flaky tests
- [ ] Coverage reasonable (>70%)

### Specific Test Files
- [ ] `tests/integration/bot-to-agent.test.ts` - Passes
- [ ] `tests/integration/full-flow.test.ts` - Passes
- [ ] `tests/unit/api/*.test.ts` - All pass
- [ ] `tests/unit/bot/*.test.ts` - All pass
- [ ] `tests/unit/wallet/*.test.ts` - All pass

---

## 13. Performance Tests

### Response Times
- [ ] Health check < 100ms
- [ ] `/api/auth/me` < 200ms
- [ ] `/api/deals` < 300ms
- [ ] Agent response < 5s (with tools)

### Load
- [ ] 10 concurrent requests handled
- [ ] No timeouts under normal load
- [ ] Memory usage stable

### Database
- [ ] Queries use indexes
- [ ] No N+1 query issues
- [ ] Connection pool stable

---

## 14. Security Tests

### Authentication
- [ ] Can't access other creator's data
- [ ] JWT verification works
- [ ] Expired tokens rejected

### Secrets
- [ ] Platform tokens encrypted at rest
- [ ] No secrets in logs
- [ ] No secrets in error messages

### Webhooks
- [ ] WhatsApp signature verification works
- [ ] Invalid signatures rejected
- [ ] Telegram webhooks validated

### Spending Controls
- [ ] Can't exceed per-transaction limit
- [ ] Can't exceed daily limit
- [ ] Can't exceed monthly limit

---

## 15. Build & Deployment Tests

### Backend Build
- [ ] `npm run build` succeeds
- [ ] No TypeScript errors
- [ ] `dist/` directory created
- [ ] `node dist/index.js` runs

### Dashboard Build
- [ ] `cd dashboard && npm run build` succeeds
- [ ] No Next.js errors
- [ ] `.next/` directory created
- [ ] `npm run start` works

### Docker Build
- [ ] Backend Dockerfile builds: `docker build -t indyfren-api .`
- [ ] Dashboard Dockerfile builds
- [ ] `docker-compose up` starts all services
- [ ] Services communicate correctly

---

## Issues Found

### Critical Issues
*Record any critical bugs that block core functionality*

- [ ] Issue 1:
- [ ] Issue 2:

### Medium Issues
*Record bugs that affect user experience but have workarounds*

- [ ] Issue 1:
- [ ] Issue 2:

### Minor Issues
*Record cosmetic issues or minor bugs*

- [ ] Issue 1:
- [ ] Issue 2:

---

## Test Results Summary

**Date:** ___________
**Tester:** ___________

**Backend API:** ☐ Pass ☐ Fail ☐ With Issues
**Dashboard:** ☐ Pass ☐ Fail ☐ With Issues
**Telegram Bot:** ☐ Pass ☐ Fail ☐ With Issues ☐ Skipped (not configured)
**WhatsApp Bot:** ☐ Pass ☐ Fail ☐ With Issues ☐ Skipped (not configured)
**Agent System:** ☐ Pass ☐ Fail ☐ With Issues
**Wallet/Payments:** ☐ Pass ☐ Fail ☐ With Issues
**Platform OAuth:** ☐ Pass ☐ Fail ☐ With Issues
**Jobs/Automation:** ☐ Pass ☐ Fail ☐ With Issues

**Overall:** ☐ Ready for Production ☐ Needs Fixes ☐ Major Issues

**Notes:**
___________________________________________________________________________
___________________________________________________________________________
___________________________________________________________________________
