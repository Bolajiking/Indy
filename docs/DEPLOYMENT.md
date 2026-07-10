# Indyfren Deployment Guide

**Last Updated:** March 20, 2026

---

## Overview

Indyfren runs as two separate services:

- **Backend API** - Node.js/Hono server → **Railway**
- **Dashboard** - Next.js app → **Vercel**

Both services are deployed automatically via GitHub Actions on push to `main`.

---

## Prerequisites

### Required Accounts

1. **Railway** account - https://railway.app
2. **Vercel** account - https://vercel.com
3. **Supabase** project - https://supabase.com
4. **Privy** app - https://privy.io
5. **AI provider** API key - Anthropic by default, or an OpenAI-compatible provider with `AI_PROVIDER=openai`

### Required Tools (for manual deployment)

- Node.js 22+
- Railway CLI: `npm install -g @railway/cli`
- Vercel CLI: `npm install -g vercel`
- Git

---

## Quick Start (Automated Deployment)

### 1. Fork and Clone

```bash
git clone https://github.com/your-org/indyfren.git
cd indyfren
```

### 2. Set Up GitHub Secrets

Go to your repository → Settings → Secrets and variables → Actions

Add these secrets:

**Backend (Railway):**

- `RAILWAY_TOKEN` - Railway API token
- `AI_PROVIDER` - Optional; defaults to `anthropic`
- `ANTHROPIC_API_KEY` - Your Anthropic API key, or set `AI_PROVIDER=openai` and provide `AI_API_KEY` / `OPENAI_API_KEY`
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_KEY` - Supabase service role key
- `PRIVY_APP_ID` - Privy application ID
- `PRIVY_APP_SECRET` - Privy application secret

**Dashboard (Vercel):**

- `VERCEL_TOKEN` - Vercel API token
- `VERCEL_ORG_ID` - Vercel organization ID
- `VERCEL_PROJECT_ID` - Vercel project ID
- `NEXT_PUBLIC_PRIVY_APP_ID` - Privy app ID (public)

### 3. Push to Main

```bash
git push origin main
```

GitHub Actions will automatically:

1. Run all tests
2. Build both services
3. Deploy backend to Railway
4. Deploy dashboard to Vercel

---

## Manual Deployment

### Backend (Railway)

#### 1. Create Railway Project

```bash
railway login
railway init
```

#### 2. Add Redis Service

```bash
railway add
# Select "Redis" from the list
```

#### 3. Set Environment Variables

In Railway dashboard or via CLI:

```bash
# Required
railway variables set ANTHROPIC_API_KEY=sk-ant-...
railway variables set SUPABASE_URL=https://xxx.supabase.co
railway variables set SUPABASE_SERVICE_KEY=eyJ...
railway variables set PRIVY_APP_ID=clxxx...
railway variables set PRIVY_APP_SECRET=xxx...
railway variables set PRIVY_JWT_VERIFICATION_KEY=xxx...
railway variables set MESSAGING_LINK_SECRET=replace-with-generated-unique-secret
railway variables set PLATFORM_ENCRYPTION_KEY_VERSION=2
railway variables set PLATFORM_ENCRYPTION_KEY_CURRENT=replace-with-output-of-openssl-rand-base64-32

# Telegram polling (set ENABLE_TELEGRAM_BOT=false and TELEGRAM_MODE=disabled to disable)
railway variables set ENABLE_TELEGRAM_BOT=true
railway variables set TELEGRAM_MODE=polling
railway variables set TELEGRAM_BOT_TOKEN=123456:ABC...

# Optional WhatsApp integration
railway variables set ENABLE_WHATSAPP=true
railway variables set WHATSAPP_PHONE_NUMBER_ID=...
railway variables set WHATSAPP_ACCESS_TOKEN=...
railway variables set WHATSAPP_VERIFY_TOKEN=replace-with-generated-unique-verify-token
railway variables set WHATSAPP_WEBHOOK_SECRET=replace-with-meta-app-secret

# Optional YouTube OAuth integration
railway variables set ENABLE_YOUTUBE_OAUTH=true
railway variables set GOOGLE_OAUTH_CLIENT_ID=...
railway variables set GOOGLE_OAUTH_CLIENT_SECRET=...
railway variables set YOUTUBE_OAUTH_REDIRECT_URI=https://your-api.railway.app/api/platforms/oauth/youtube/callback
railway variables set DASHBOARD_APP_URL=https://your-dashboard.vercel.app

# Optional (for browser automation)
railway variables set BROWSERBASE_API_KEY=...
railway variables set BROWSERBASE_PROJECT_ID=...

# System
railway variables set NODE_ENV=production
railway variables set PORT=3000
railway variables set TRUSTED_PROXY_HOPS=1
railway variables set ENABLE_JOBS=true
railway variables set REDIS_URL=${{Redis.REDIS_URL}}
railway variables set ENABLE_DISTRIBUTED_RATE_LIMIT=true
```

#### 4. Deploy

```bash
railway up
```

#### 5. Initialize Database

After first deployment:

```bash
railway run npm run db:init
```

Optional - seed demo data:

```bash
railway run npm run db:seed
```

#### 6. Get Your API URL

```bash
railway domain
# Returns: https://your-app.railway.app
```

---

### Dashboard (Vercel)

#### 1. Install Vercel CLI

```bash
npm install -g vercel
```

#### 2. Deploy Dashboard

```bash
cd dashboard
vercel
```

Follow the prompts:

- Link to existing project or create new
- Set framework preset: **Next.js**
- Build command: `npm run build`
- Output directory: `.next`

#### 3. Set Environment Variables

In Vercel dashboard → Settings → Environment Variables:

**Production:**

- `NEXT_PUBLIC_API_URL` = `https://your-api.railway.app`
- `NEXT_PUBLIC_PRIVY_APP_ID` = `clxxx...`

**Preview & Development:**

- `NEXT_PUBLIC_API_URL` = `http://localhost:3000`
- `NEXT_PUBLIC_PRIVY_APP_ID` = `clxxx...`

#### 4. Deploy to Production

```bash
vercel --prod
```

#### 5. Get Your Dashboard URL

Vercel will output your production URL:

```
https://indyfren.vercel.app
```

---

## Database Setup (Supabase)

### 1. Create Supabase Project

- Go to https://supabase.com
- Create new project
- Note your project URL and service key

### 2. Initialize Schema

Either use the Supabase SQL Editor:

1. Open SQL Editor in Supabase dashboard
2. Copy contents of `src/db/schema.sql`
3. Execute

Or use the init script (after backend deployed):

```bash
railway run npm run db:init
```

### 3. Verify Tables

Check these tables exist:

- `creators`
- `deals`
- `transactions`
- `platform_connections`
- `messages`
- `agent_actions`

---

## Post-Deployment Configuration

### 1. Update Dashboard App URL

In Railway, update `DASHBOARD_APP_URL`:

```bash
railway variables set DASHBOARD_APP_URL=https://indyfren.vercel.app
```

Redeploy if needed:

```bash
railway up
```

### 2. Configure Webhooks

#### Telegram Bot

Set webhook URL and ask Telegram to authenticate every delivery. Keep the secret
in the `secret_token` form field; do not append it to the webhook URL or print its
value in deployment logs. Before running this command, set
`TELEGRAM_MODE=webhook` and configure `TELEGRAM_WEBHOOK_SECRET` in Railway.
Use 32-256 characters from `A-Z`, `a-z`, `0-9`, `_`, and `-`, for example
a value generated with `openssl rand -hex 32`.

```bash
curl --request POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  --form-string "url=https://your-api.railway.app/webhooks/telegram" \
  --form-string "secret_token=${TELEGRAM_WEBHOOK_SECRET}"
```

Telegram generates the `X-Telegram-Bot-Api-Secret-Token` request header from
that field. Indyfren accepts the route only when `TELEGRAM_MODE=webhook` and the
header exactly matches `TELEGRAM_WEBHOOK_SECRET`; polling and disabled modes
return `404`.

Verify webhook:

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

#### WhatsApp Bot

1. Go to Meta Business Suite → WhatsApp → Configuration
2. Set webhook URL: `https://your-api.railway.app/webhooks/whatsapp`
3. Set verify token: (same as `WHATSAPP_VERIFY_TOKEN`)
4. Subscribe to `messages` events

### 3. Configure YouTube OAuth

In Google Cloud Console:

1. Add authorized redirect URI:
   - `https://your-api.railway.app/api/platforms/oauth/youtube/callback`
2. Update `YOUTUBE_OAUTH_REDIRECT_URI` in Railway

### 4. Update CORS (if needed)

If dashboard and API are on different domains, verify CORS headers in backend.

---

## Health Checks & Monitoring

### Health Endpoints

**Backend:**

```bash
curl https://your-api.railway.app/health
```

Expected:

```json
{
  "status": "ok",
  "timestamp": "2026-07-03T12:00:00.000Z"
}
```

This is a cheap liveness check. Verify dependency readiness separately:

```bash
curl https://your-api.railway.app/health/ready
```

Expected when ready:

```json
{
  "ready": true,
  "checks": {
    "database": "ok",
    "rateLimit": "ok"
  }
}
```

Readiness returns `503` with `ready: false` and an `"unreachable"` check when the database or rate-limit Redis is unavailable.

**Dashboard:**

```bash
curl https://indyfren.vercel.app
```

Should return HTML.

### Railway Monitoring

Railway provides:

- CPU/Memory metrics
- Deployment logs
- Build logs
- Service status

Access via: https://railway.app/project/{your-project}

### Vercel Monitoring

Vercel provides:

- Analytics
- Web Vitals
- Function logs
- Build logs

Access via: https://vercel.com/{your-team}/{project}

---

## Environment Variables Reference

### Backend (Railway)

| Variable                           | Required      | Default            | Description                                                    |
| ---------------------------------- | ------------- | ------------------ | -------------------------------------------------------------- |
| `AI_PROVIDER`                      | No            | anthropic          | Agent AI provider: `anthropic` or `openai`                     |
| `AI_API_KEY`                       | No            | -                  | Provider-neutral API key override                              |
| `AI_BASE_URL`                      | No            | -                  | OpenAI-compatible or Anthropic-compatible provider base URL    |
| `AI_MODEL`                         | No            | -                  | Default-tier model override                                    |
| `AI_FAST_MODEL`                    | No            | -                  | Fast-tier model override                                       |
| `ANTHROPIC_API_KEY`                | Conditionally | -                  | Required for Anthropic unless `AI_API_KEY` is set              |
| `OPENAI_API_KEY`                   | Conditionally | -                  | Required for OpenAI unless `AI_API_KEY` is set                 |
| `SUPABASE_URL`                     | Yes           | -                  | Supabase project URL                                           |
| `SUPABASE_SERVICE_KEY`             | Yes           | -                  | Supabase service role key                                      |
| `PRIVY_APP_ID`                     | Yes           | -                  | Privy application ID                                           |
| `PRIVY_APP_SECRET`                 | Yes           | -                  | Privy application secret                                       |
| `PRIVY_JWT_VERIFICATION_KEY`       | Yes           | -                  | JWT verification key                                           |
| `MESSAGING_LINK_SECRET`            | Yes           | -                  | Unique secret used to sign messaging-link tokens               |
| `PLATFORM_ENCRYPTION_KEY_VERSION`  | Yes           | -                  | Positive integer identifying the active key                    |
| `PLATFORM_ENCRYPTION_KEY_CURRENT`  | Yes           | -                  | Canonical base64 encoding of the active 32-byte key             |
| `PLATFORM_ENCRYPTION_KEY_PREVIOUS_VERSION` | No     | -                  | Previous integer version, configured only during rotation       |
| `PLATFORM_ENCRYPTION_KEY_PREVIOUS` | No            | -                  | Previous 32-byte base64 key retained during rotation            |
| `REDIS_URL`                        | Yes           | -                  | Mandatory non-loopback Redis service in production             |
| `PORT`                             | No            | 3000               | API server port                                                |
| `NODE_ENV`                         | No            | development        | Node environment                                               |
| `TRUSTED_PROXY_HOPS`               | No            | 0                  | Trusted reverse-proxy hops; integer from 0 through 2           |
| `ENABLE_TELEGRAM_BOT`              | No            | true               | Strict boolean master switch for Telegram configuration        |
| `TELEGRAM_MODE`                    | No            | polling            | Telegram mode: `disabled`, `polling`, or `webhook`             |
| `TELEGRAM_BOT_TOKEN`               | Conditionally | -                  | Required when Telegram is enabled and mode is not `disabled`   |
| `TELEGRAM_WEBHOOK_SECRET`          | Conditionally | -                  | Required when Telegram is enabled in `webhook` mode            |
| `ENABLE_WHATSAPP`                  | No            | false              | Strict boolean enabling WhatsApp production configuration      |
| `WHATSAPP_PHONE_NUMBER_ID`         | Conditionally | -                  | Required when WhatsApp is enabled                              |
| `WHATSAPP_ACCESS_TOKEN`            | Conditionally | -                  | Required when WhatsApp is enabled                              |
| `WHATSAPP_VERIFY_TOKEN`            | Conditionally | -                  | Unique verify token required when WhatsApp is enabled          |
| `WHATSAPP_WEBHOOK_SECRET`          | Conditionally | -                  | Meta app secret required when WhatsApp is enabled              |
| `ENABLE_YOUTUBE_OAUTH`             | No            | false              | Strict boolean enabling YouTube OAuth production configuration |
| `GOOGLE_OAUTH_CLIENT_ID`           | Conditionally | -                  | Required when YouTube OAuth is enabled                         |
| `GOOGLE_OAUTH_CLIENT_SECRET`       | Conditionally | -                  | Required when YouTube OAuth is enabled                         |
| `YOUTUBE_OAUTH_REDIRECT_URI`       | Conditionally | -                  | Required when YouTube OAuth is enabled                         |
| `DASHBOARD_APP_URL`                | No            | -                  | Dashboard URL for redirects                                    |
| `BROWSERBASE_API_KEY`              | No            | -                  | BrowserBase API key                                            |
| `BROWSERBASE_PROJECT_ID`           | No            | -                  | BrowserBase project ID                                         |
| `ENABLE_JOBS`                      | No            | true               | Strict boolean enabling jobs; required for Telegram webhook mode or WhatsApp, and requires Redis when true |
| `ENABLE_DISTRIBUTED_RATE_LIMIT`    | Yes           | true in production | Must be true in production; false is development/test only     |
| `ERROR_REPORTING_DSN`              | No            | -                  | Optional error-reporting provider DSN                          |
| `PUBLIC_SUPPORT_EMAIL`             | No            | -                  | Optional valid public support email address                    |

### Dashboard (Vercel)

| Variable                   | Required | Default | Description           |
| -------------------------- | -------- | ------- | --------------------- |
| `NEXT_PUBLIC_API_URL`      | Yes      | -       | Backend API URL       |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Yes      | -       | Privy app ID (public) |

---

## Scaling

### Backend Scaling (Railway)

Railway auto-scales based on load. Configure in `railway.json`:

```json
{
  "deploy": {
    "numReplicas": 1,
    "restartPolicyType": "ON_FAILURE"
  }
}
```

For high traffic:

- Increase replicas: 2-4 instances
- Upgrade Railway plan for more resources
- Consider dedicated Redis instance

### Dashboard Scaling (Vercel)

Vercel auto-scales globally via edge network. No configuration needed.

For high traffic:

- Upgrade Vercel plan for higher limits
- Enable ISR (Incremental Static Regeneration) for cached routes

---

## Backups

### Database Backups (Supabase)

Supabase automatically backs up your database daily.

Manual backup:

1. Go to Supabase dashboard
2. Database → Backups
3. Download backup or enable Point-in-Time Recovery (PITR)

### Code Backups

All code is in Git. Tag releases:

```bash
git tag -a v1.0.0 -m "Production release v1.0.0"
git push origin v1.0.0
```

---

## Rollback

### Backend Rollback (Railway)

1. Go to Railway dashboard
2. Select deployment to rollback to
3. Click "Redeploy"

Or via CLI:

```bash
railway redeploy <deployment-id>
```

### Dashboard Rollback (Vercel)

1. Go to Vercel dashboard
2. Deployments → Find previous deployment
3. Click "Promote to Production"

Or via CLI:

```bash
vercel rollback
```

---

## Troubleshooting

### Backend won't start

**Check logs:**

```bash
railway logs
```

**Common issues:**

- Missing environment variables → Add required vars
- Database connection failed → Check Supabase credentials
- Redis connection failed → Verify Redis service running
- Port binding issues → Railway auto-assigns port

### Dashboard won't build

**Check build logs:**

```bash
vercel logs
```

**Common issues:**

- Missing `NEXT_PUBLIC_API_URL` → Add to Vercel env vars
- Build timeout → Increase timeout in `vercel.json`
- API proxy failing → Verify backend is running

### Telegram bot not responding

1. Check webhook is set: `curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
2. Verify webhook URL is correct
3. Check Railway logs for incoming webhooks
4. Verify `TELEGRAM_BOT_TOKEN` is set

### WhatsApp webhook failing

1. Check signature verification in logs
2. Verify `WHATSAPP_WEBHOOK_SECRET` matches Meta config
3. Test webhook verification: `GET /webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=test`

### Agent not responding

1. Check the configured AI provider key is valid
2. Verify credits or wallet balance
3. Check tool execution logs
4. Verify database connection

---

## Rotating Platform Credential Keys

Generate a new key with `openssl rand -base64 32`. Keep the old key available as
the previous version, increment the active positive-integer version, and deploy:

```bash
PLATFORM_ENCRYPTION_KEY_VERSION=3
PLATFORM_ENCRYPTION_KEY_CURRENT=<new-key>
PLATFORM_ENCRYPTION_KEY_PREVIOUS_VERSION=2
PLATFORM_ENCRYPTION_KEY_PREVIOUS=<old-key>
```

From a trusted, controlled environment with access to both configured keys,
preview one bounded batch. Dry-run reads and decrypts credentials to validate
them, but performs no database writes:

```bash
npm run migrate:platform-secrets -- --dry-run --batch-size 100
```

Apply the same batch without `--dry-run`. When output includes a resume cursor,
rerun with `--after-id <cursor>` until `Complete: yes`. A failed count produces a
non-zero exit; retain both keys, investigate configuration/database access, and
resume from the last successful batch boundary. Logs contain row counts and cursor
IDs only, never decrypted credentials. After all rows are current and application
reads have been observed healthy, remove both previous-key variables in a separate
deployment. Legacy `v1` envelopes are read only to support this migration; all new
writes use authenticated `v2:<key-version>:...` envelopes.

## Security Checklist

Before going live:

- [ ] All secrets in GitHub Secrets (not committed)
- [ ] Environment variables set in Railway/Vercel
- [ ] HTTPS enabled (automatic on Railway/Vercel)
- [ ] Database RLS policies active (Supabase)
- [ ] Platform secrets encrypted at rest
- [ ] Webhook signatures verified
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] Error messages don't leak secrets
- [ ] Spending limits configured
- [ ] API keys rotated from defaults

---

## Support

- **Documentation:** This file + `/docs`
- **GitHub Issues:** https://github.com/your-org/indyfren/issues
- **Railway Docs:** https://docs.railway.app
- **Vercel Docs:** https://vercel.com/docs

---

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing (`npm test`)
- [ ] Backend builds (`npm run build`)
- [ ] Dashboard builds (`cd dashboard && npm run build`)
- [ ] Environment variables documented
- [ ] Database schema ready
- [ ] Secrets prepared

### Railway Deployment

- [ ] Project created
- [ ] Redis service added
- [ ] Environment variables set
- [ ] Deployed successfully
- [ ] Health check returns 200
- [ ] Database initialized
- [ ] Logs show no errors

### Vercel Deployment

- [ ] Project created
- [ ] Environment variables set
- [ ] Deployed successfully
- [ ] Dashboard loads
- [ ] API proxy working
- [ ] Privy auth working

### Post-Deployment

- [ ] Telegram webhook configured (if using)
- [ ] WhatsApp webhook configured (if using)
- [ ] YouTube OAuth redirect updated (if using)
- [ ] Dashboard URL updated in backend
- [ ] Health checks passing
- [ ] Monitoring set up
- [ ] Backups verified

### Go Live

- [ ] Smoke test full user flow
- [ ] Create test creator account
- [ ] Test bot commands
- [ ] Test agent responses
- [ ] Test wallet provisioning
- [ ] Test deal creation
- [ ] Monitor for errors

---

**Ready to deploy? Follow the Quick Start section above!** 🚀
