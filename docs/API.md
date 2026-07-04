# Indyfren API Documentation

**Base URL:** `https://your-api.railway.app` (or `http://localhost:3000` for development)

**Version:** 1.0
**Last Updated:** 2026-03-20

---

## Authentication

Most API routes require **Privy authentication**. Include the Privy access token in the `Authorization` header:

```
Authorization: Bearer <privy_access_token>
```

### Getting a Privy Token

1. Sign in via the Indyfren dashboard (using Privy SDK)
2. The dashboard automatically includes the token in API calls
3. For direct API access, obtain a token from Privy's authentication flow

### Unauthenticated Routes

- `GET /health`
- `GET /health/ready`
- `GET /webhooks/whatsapp` (webhook verification)
- `POST /webhooks/telegram` (webhook)
- `POST /webhooks/whatsapp` (webhook)

---

## Health & Status

### GET /health

Cheap process liveness check. This endpoint does not probe external dependencies.

**Response:** `200 OK`

```json
{
  "status": "ok",
  "timestamp": "2026-07-03T12:00:00.000Z"
}
```

### GET /health/ready

Readiness probe for deployment health checks.

**Response:** `200 OK` or `503 Service Unavailable`

```json
{
  "ready": true,
  "checks": {
    "database": "ok",
    "rateLimit": "ok"
  }
}
```

When a dependency is unavailable, the endpoint returns `503` with `ready: false` and that check set to `"unreachable"`.

---

## Authentication & Profile

### POST /api/auth/register

Register a new creator (requires Privy token).

**Headers:**

```
Authorization: Bearer <privy_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "display_name": "John Doe",
  "niche": "tech reviews"
}
```

**Response:** `201 Created`

```json
{
  "id": "creator-123",
  "privy_user_id": "did:privy:abc123",
  "display_name": "John Doe",
  "niche": "tech reviews",
  "free_credits_remaining_cents": 1000,
  "onboarding": {
    "status": "wallet_pending",
    "walletProvisioned": false
  },
  "created_at": "2026-03-20T12:00:00.000Z"
}
```

### GET /api/auth/me

Get current authenticated creator profile.

**Headers:**

```
Authorization: Bearer <privy_token>
```

**Response:** `200 OK`

```json
{
  "creator": {
    "id": "creator-123",
    "privy_user_id": "did:privy:abc123",
    "display_name": "John Doe",
    "niche": "tech reviews",
    "wallet_id": "wallet-456",
    "wallet_address": "0x1234567890123456789012345678901234567890",
    "free_credits_remaining_cents": 850,
    "settings": {
      "per_transaction_limit_cents": 500,
      "daily_limit_cents": 5000,
      "monthly_limit_cents": 50000
    }
  },
  "onboarding": {
    "status": "active",
    "walletProvisioned": true
  }
}
```

**Error Responses:**

- `401 Unauthorized` - Invalid or missing Privy token
- `404 Not Found` - Creator not registered

### POST /api/auth/onboarding

Complete creator onboarding (set niche, platforms, etc.).

**Request Body:**

```json
{
  "niche": "fitness coaching",
  "platforms": ["YouTube", "Instagram"],
  "followerCount": "10k-100k"
}
```

**Response:** `200 OK`

```json
{
  "success": true
}
```

### POST /api/auth/me/wallet/retry

Retry wallet provisioning if it failed during onboarding.

**Response:** `200 OK`

```json
{
  "success": true,
  "walletProvisioned": true,
  "walletAddress": "0x..."
}
```

---

## Deals

### GET /api/deals

List all deals for the authenticated creator.

**Query Parameters:**

- `stage` (optional): Filter by stage (`discovered`, `pitched`, `negotiating`, `contracted`, `active`, `completed`, `rejected`)

**Response:** `200 OK`

```json
[
  {
    "id": "deal-1",
    "creator_id": "creator-123",
    "brand_name": "TechCorp",
    "stage": "pitched",
    "fit_score": 85,
    "estimated_value_cents": 300000,
    "notes": "Great fit for tech reviews",
    "brand_contact_email": "partnerships@techcorp.com",
    "created_at": "2026-03-15T10:00:00.000Z",
    "updated_at": "2026-03-18T14:30:00.000Z"
  }
]
```

### POST /api/deals

Create a new deal manually.

**Request Body:**

```json
{
  "brand_name": "FitnessBrand",
  "stage": "discovered",
  "fit_score": 75,
  "estimated_value_cents": 150000,
  "notes": "Found via email outreach",
  "brand_contact_email": "marketing@fitnessbrand.com"
}
```

**Response:** `201 Created`

```json
{
  "id": "deal-2",
  "creator_id": "creator-123",
  "brand_name": "FitnessBrand",
  "stage": "discovered",
  "fit_score": 75,
  "estimated_value_cents": 150000,
  "notes": "Found via email outreach",
  "created_at": "2026-03-20T12:00:00.000Z"
}
```

### PATCH /api/deals/:dealId

Update an existing deal.

**Request Body:**

```json
{
  "stage": "negotiating",
  "notes": "Discussed rates, waiting on contract"
}
```

**Response:** `200 OK`

```json
{
  "id": "deal-1",
  "stage": "negotiating",
  "notes": "Discussed rates, waiting on contract",
  "updated_at": "2026-03-20T13:00:00.000Z"
}
```

---

## Platform Connections

### GET /api/platforms

List connected platforms for the authenticated creator.

**Response:** `200 OK`

```json
[
  {
    "platform": "youtube",
    "platform_username": "johndoe",
    "platform_user_id": "UC1234567890",
    "connected_at": "2026-03-10T08:00:00.000Z"
  },
  {
    "platform": "instagram",
    "platform_username": "@johndoe",
    "connected_at": "2026-03-12T10:00:00.000Z"
  }
]
```

### POST /api/platforms/connect

Connect a platform manually (token-based).

**Request Body:**

```json
{
  "platform": "youtube",
  "accessToken": "ya29.a0AfH6SMB...",
  "username": "johndoe",
  "refreshToken": "1//0gHW...",
  "userId": "UC1234567890",
  "expiresAt": "2026-04-20T12:00:00.000Z"
}
```

**Response:** `200 OK`

```json
{
  "success": true,
  "platform": "youtube",
  "username": "johndoe"
}
```

### DELETE /api/platforms/:platform

Disconnect a platform.

**Response:** `200 OK`

```json
{
  "success": true
}
```

**Error:** `404 Not Found` if platform was not connected.

### GET /api/platforms/oauth/providers

Get available OAuth providers.

**Response:** `200 OK`

```json
[
  {
    "platform": "youtube",
    "enabled": true,
    "displayName": "YouTube"
  },
  {
    "platform": "instagram",
    "enabled": false,
    "displayName": "Instagram"
  }
]
```

### POST /api/platforms/oauth/youtube/start

Start YouTube OAuth flow.

**Response:** `200 OK`

```json
{
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...",
  "state": "creator-123:1234567890:abc123"
}
```

**Usage:**

1. Call this endpoint
2. Redirect user to `authUrl`
3. Google will redirect back to `/api/platforms/oauth/youtube/callback`
4. Callback handler will redirect to dashboard with `?oauth=success`

### GET /api/platforms/oauth/youtube/callback

YouTube OAuth callback (called by Google, not directly).

**Query Parameters:**

- `code` - Authorization code from Google
- `state` - Signed state token
- `error` - Error code if user denied

**Response:** Redirects to dashboard

- Success: `/dashboard/settings?oauth=success`
- Error: `/dashboard/settings?oauth=error&error=<reason>`

---

## Wallet & Transactions

### GET /api/wallet/transactions

List wallet transactions for the authenticated creator.

**Query Parameters:**

- `limit` (optional, default: 50): Maximum number of results

**Response:** `200 OK`

```json
[
  {
    "id": "tx-1",
    "creator_id": "creator-123",
    "type": "agent_tool_usage",
    "amount_cents": 25,
    "currency": "USD",
    "description": "Web search via Exa API",
    "service": "stableenrich",
    "metadata": {
      "tool": "web_search",
      "query": "tech brand partnerships"
    },
    "created_at": "2026-03-20T12:00:00.000Z"
  },
  {
    "id": "tx-2",
    "type": "credit_deduction",
    "amount_cents": 50,
    "description": "Brand enrichment lookup",
    "service": "stableenrich",
    "created_at": "2026-03-20T11:30:00.000Z"
  }
]
```

**Transaction Types:**

- `agent_tool_usage` - Paid tool call by agent
- `credit_deduction` - Free credits spent
- `wallet_funding` - Funds added to wallet
- `refund` - Refunded transaction

---

## Reports

### GET /api/reports/financial

Get financial snapshot for the authenticated creator.

**Response:** `200 OK`

```json
{
  "creatorId": "creator-123",
  "period": "last_30_days",
  "income": {
    "totalCents": 500000,
    "bySource": {
      "brand_deals": 450000,
      "sponsorships": 50000
    }
  },
  "expenses": {
    "totalCents": 5000,
    "agentSpendCents": 2500,
    "byCategory": {
      "research": 1500,
      "email": 500,
      "media": 500
    }
  },
  "netCents": 495000,
  "pipeline": {
    "activeDealCount": 5,
    "totalPipelineValueCents": 1000000
  },
  "forecast": {
    "nextMonthEstimateCents": 600000,
    "confidence": "medium"
  }
}
```

### GET /api/reports/analytics

Get aggregated analytics across all connected platforms.

**Response:** `200 OK`

```json
{
  "creatorId": "creator-123",
  "collectedAt": "2026-03-20T12:00:00.000Z",
  "platforms": [
    {
      "platform": "youtube",
      "username": "johndoe",
      "followers": 50000,
      "views30d": 100000,
      "engagementRate": 4.5
    },
    {
      "platform": "instagram",
      "username": "@johndoe",
      "followers": 25000,
      "engagementRate": 3.2
    }
  ],
  "totalFollowers": 75000,
  "avgEngagementRate": 3.85
}
```

### GET /api/reports/calendar

Get upcoming deadlines and scheduled tasks.

**Response:** `200 OK`

```json
{
  "upcoming": [
    {
      "date": "2026-03-25",
      "title": "Content deadline - TechCorp",
      "type": "deadline",
      "dealId": "deal-1"
    },
    {
      "date": "2026-03-28",
      "title": "Follow-up call - FitnessBrand",
      "type": "meeting"
    }
  ],
  "overdue": [
    {
      "date": "2026-03-18",
      "title": "Invoice #123 - OldBrand",
      "type": "invoice"
    }
  ]
}
```

---

## Webhooks

### POST /webhooks/telegram

Telegram bot webhook endpoint. It is active only when `TELEGRAM_MODE=webhook`.
Polling and disabled modes return `404`.
The configured secret must be a random 32-256 character value containing only
letters, numbers, underscores, and hyphens; replace the example
`replace_with_32_plus_random_chars_1234567890` before deployment.

**Setup:**

```bash
curl --request POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  --form-string "url=https://your-api.railway.app/webhooks/telegram" \
  --form-string "secret_token=${TELEGRAM_WEBHOOK_SECRET}"
```

Pass the secret as Telegram's `secret_token` field, never as part of the webhook
URL. Telegram then supplies it in the
`X-Telegram-Bot-Api-Secret-Token` header on each delivery.

**Request:** Telegram webhook payload with the
`X-Telegram-Bot-Api-Secret-Token` header (automatically sent by Telegram)

**Response:** `200 OK`

### GET /webhooks/whatsapp

WhatsApp webhook verification.

**Query Parameters:**

- `hub.mode=subscribe`
- `hub.verify_token=<your_verify_token>`
- `hub.challenge=<random_string>`

**Response:** `200 OK` with challenge string

### POST /webhooks/whatsapp

WhatsApp message webhook.

**Headers:**

- `x-hub-signature-256` - HMAC signature for verification

**Request:** WhatsApp webhook payload

**Response:** `200 OK`

---

## Error Responses

All error responses follow this format:

```json
{
  "error": "Human-readable error message"
}
```

### HTTP Status Codes

- `200 OK` - Request succeeded
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid input or missing required fields
- `401 Unauthorized` - Missing or invalid authentication token
- `403 Forbidden` - Insufficient permissions or credits
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource already exists
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error
- `503 Service Unavailable` - Service temporarily unavailable

### Common Errors

**Insufficient Credits:**

```json
{
  "error": "Insufficient credits. Please fund your wallet.",
  "remainingCents": 0,
  "requiredCents": 50
}
```

**Rate Limited:**

```json
{
  "error": "Too many requests. Please try again later.",
  "retryAfter": 60
}
```

**Wallet Not Provisioned:**

```json
{
  "error": "Wallet provisioning in progress. Please wait.",
  "onboarding": {
    "status": "wallet_pending"
  }
}
```

---

## Rate Limits

- **100 requests per minute** per creator
- **1000 requests per hour** per creator
- **10,000 requests per day** per creator

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1710000000
```

---

## Pagination

List endpoints support pagination:

**Query Parameters:**

- `limit` (default: 50, max: 100)
- `offset` (default: 0)

**Response Headers:**

```
X-Total-Count: 234
Link: </api/deals?limit=50&offset=50>; rel="next"
```

---

## Webhook Security

### Telegram

Telegram webhook authentication is application-managed, not automatically
verified by grammY. Indyfren compares the configured secret with the
`X-Telegram-Bot-Api-Secret-Token` header using an equal-length, timing-safe
comparison before checking bot availability or processing the update.

### WhatsApp

WhatsApp webhooks include an HMAC signature in the `x-hub-signature-256` header. The API verifies this using your `WHATSAPP_WEBHOOK_SECRET`.

**Verification Process:**

1. Extract raw request body
2. Compute `HMAC-SHA256(secret, body)`
3. Compare with provided signature

---

## SDKs & Examples

### JavaScript/TypeScript

```typescript
// Using fetch
const response = await fetch("https://your-api.railway.app/api/deals", {
  headers: {
    Authorization: `Bearer ${privyToken}`,
    "Content-Type": "application/json",
  },
});
const deals = await response.json();

// Create a deal
await fetch("https://your-api.railway.app/api/deals", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${privyToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    brand_name: "NewBrand",
    stage: "discovered",
    estimated_value_cents: 200000,
  }),
});
```

### curl

```bash
# Get deals
curl -H "Authorization: Bearer <token>" \
  https://your-api.railway.app/api/deals

# Create deal
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"brand_name":"NewBrand","stage":"discovered"}' \
  https://your-api.railway.app/api/deals

# Get wallet transactions
curl -H "Authorization: Bearer <token>" \
  https://your-api.railway.app/api/wallet/transactions?limit=10
```

---

## Support

- **Documentation:** https://docs.indyfren.xyz
- **Email:** support@indyfren.xyz
- **GitHub:** https://github.com/indyfren/indyfren

---

**Last Updated:** March 20, 2026
**API Version:** 1.0
