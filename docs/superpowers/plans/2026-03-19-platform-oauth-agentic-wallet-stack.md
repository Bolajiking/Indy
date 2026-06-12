# Platform OAuth + Privy Agentic Wallet Stack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real provider OAuth for platform connections, starting with YouTube/Google, while keeping Privy as the creator identity layer and the existing policy-backed Privy agent wallet stack unchanged.

**Architecture:** The dashboard continues to authenticate creators with Privy bearer tokens, and the backend remains the trust boundary for provider secrets, token exchange, and platform connection persistence. OAuth state is signed server-side, callback handling is stateless and creator-bound, and provider access tokens are stored through the same encrypted `platform_connections` path already used by manual token entry. The Privy agentic wallet remains separate from social OAuth: it still provisions policy-backed server wallets for agent spending and signing, while platform OAuth only enriches the creator’s connected-account graph for analytics and deal automation.

**Tech Stack:** Hono routes, Privy auth/session middleware, existing policy-backed Privy server wallets (`@privy-io/node`), Supabase persistence, Next.js dashboard, Vitest, encrypted platform secret storage.

---

## File Structure

**Create:**

- `src/platforms/oauth.ts`
  Purpose: provider config lookup, signed OAuth state creation/verification, YouTube auth URL building, token exchange, channel profile fetch, and callback redirect helpers.
- `tests/unit/api/platform-oauth.test.ts`
  Purpose: route-level OAuth coverage for provider discovery, OAuth start, callback exchange, and redirect outcomes.

**Modify:**

- `src/api/routes/platforms.ts`
  Purpose: add OAuth provider discovery, start, and callback routes while preserving manual token connect/disconnect.
- `src/config/env.ts`
  Purpose: add optional OAuth env vars for Google/YouTube and dashboard redirect base.
- `.env.example`
  Purpose: document Google/YouTube OAuth configuration.
- `dashboard/src/lib/api.ts`
  Purpose: add authenticated OAuth provider discovery and start helpers.
- `dashboard/src/components/platform-connect.tsx`
  Purpose: surface “Connect with Google” for YouTube when configured, keep manual mode for the rest.
- `dashboard/src/app/dashboard/settings/page.tsx`
  Purpose: load provider capabilities and pass OAuth start handlers into the settings UI.
- `docs/superpowers/plans/2026-03-18-indyfren-mvp.md`
  Purpose: update the implementation log after the OAuth slice ships.

**Keep unchanged by design:**

- `src/wallet/privy.ts`
- `src/wallet/privy-provisioning.ts`
- `src/wallet/mpp.ts`

These remain the agentic wallet layer. Platform OAuth must integrate around them, not through them.

## Constraints and Defaults

- Start with **YouTube only** via Google OAuth. Do not pretend Instagram/TikTok/Twitter OAuth exists yet.
- Keep **Privy** as the only creator identity system. OAuth must never become an alternate auth path.
- Keep the **Privy agentic wallet** as the spend/signing engine. Provider OAuth tokens are for analytics/platform automation only.
- Store provider secrets only through the existing encrypted platform-connection path.
- Use a **signed, stateless state token** for OAuth callback validation. Do not rely on process memory.
- Redirect callback completions back to `/dashboard/settings` with explicit success/error query params.

## Task 1: Add the OAuth env contract

**Files:**

- Modify: `.env.example`
- Modify: `src/config/env.ts`
- Test: none (covered by downstream route/helper tests)

- [ ] **Step 1: Add optional Google/YouTube OAuth env vars to `.env.example`**

Add:

```env
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
YOUTUBE_OAUTH_REDIRECT_URI=http://localhost:3000/api/platforms/oauth/youtube/callback
DASHBOARD_APP_URL=http://localhost:3001
```

- [ ] **Step 2: Add optional env parsing in `src/config/env.ts`**

Add `.default("")` entries for:

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `YOUTUBE_OAUTH_REDIRECT_URI`
- `DASHBOARD_APP_URL`

- [ ] **Step 3: Run typecheck**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add .env.example src/config/env.ts
git commit -m "chore: add platform oauth env contract"
```

## Task 2: Build the provider helper around the existing security model

**Files:**

- Create: `src/platforms/oauth.ts`
- Test: `tests/unit/api/platform-oauth.test.ts`

- [ ] **Step 1: Write the failing tests for OAuth state and callback-driven persistence**

Tests to cover:

- provider discovery reports YouTube enabled only when env is configured
- start route returns a Google auth URL with signed state
- callback exchanges code, fetches YouTube channel metadata, and stores the connection with encrypted tokens
- callback redirects to dashboard settings with explicit success/error query params

Run: `npm test -- tests/unit/api/platform-oauth.test.ts`
Expected: FAIL because `src/platforms/oauth.ts` and OAuth routes do not exist yet

- [ ] **Step 2: Implement `src/platforms/oauth.ts` with minimal YouTube-only support**

Include:

- `getPlatformOAuthProviders()`
- `createPlatformOAuthState()`
- `verifyPlatformOAuthState()`
- `buildPlatformOAuthUrl()`
- `exchangeYouTubeOAuthCode()`
- `fetchYouTubeChannelIdentity()`
- `buildPlatformOAuthRedirect()`

Implementation notes:

- Sign state using HMAC derived from `PRIVY_APP_SECRET`
- Use `https://accounts.google.com/o/oauth2/v2/auth`
- Use `https://oauth2.googleapis.com/token`
- Use `https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true`
- Request scope: `https://www.googleapis.com/auth/youtube.readonly`
- Request offline access so refresh tokens can be returned

- [ ] **Step 3: Run the focused tests**

Run: `npm test -- tests/unit/api/platform-oauth.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/platforms/oauth.ts tests/unit/api/platform-oauth.test.ts
git commit -m "feat: add youtube oauth helper flow"
```

## Task 3: Add OAuth routes to the platforms API

**Files:**

- Modify: `src/api/routes/platforms.ts`
- Test: `tests/unit/api/platform-oauth.test.ts`

- [ ] **Step 1: Write or extend failing route tests if needed**

Ensure route coverage exists for:

- `GET /api/platforms/oauth/providers`
- `POST /api/platforms/oauth/youtube/start`
- `GET /api/platforms/oauth/youtube/callback`

Run: `npm test -- tests/unit/api/platform-oauth.test.ts`
Expected: FAIL on missing routes/behavior

- [ ] **Step 2: Add OAuth endpoints to `src/api/routes/platforms.ts`**

Add:

- `GET /oauth/providers` — authenticated, returns provider capability list
- `POST /oauth/:platform/start` — authenticated, returns provider auth URL bound to the current Privy creator session
- `GET /oauth/:platform/callback` — unauthenticated provider callback, validates signed state, exchanges code, fetches provider profile, persists connection with encrypted secrets, redirects to dashboard settings

Persistence rules:

- `creator_id` comes from the signed state
- `platform` is `youtube`
- `metadata` should include `connection_method: "oauth"`
- `platform_username` and `platform_user_id` come from the YouTube channel lookup

- [ ] **Step 3: Run focused API tests**

Run: `npm test -- tests/unit/api/platform-oauth.test.ts tests/unit/api/platforms.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/api/routes/platforms.ts tests/unit/api/platform-oauth.test.ts tests/unit/api/platforms.test.ts
git commit -m "feat: add platform oauth api routes"
```

## Task 4: Wire dashboard OAuth discovery and launch

**Files:**

- Modify: `dashboard/src/lib/api.ts`
- Modify: `dashboard/src/components/platform-connect.tsx`
- Modify: `dashboard/src/app/dashboard/settings/page.tsx`
- Test: use dashboard production build as the verification gate

- [ ] **Step 1: Add dashboard API helpers**

In `dashboard/src/lib/api.ts`, add:

- `fetchPlatformOAuthProviders(accessToken)`
- `startPlatformOAuth(accessToken, platform)`

The start helper should call the backend start route and return the URL for client-side navigation.

- [ ] **Step 2: Update `PlatformConnect` for hybrid connection UX**

Behavior:

- If YouTube OAuth is enabled, show a primary “Connect with Google” action
- Keep the manual token entry path available as an explicit advanced fallback
- For non-OAuth providers, keep the existing manual flow
- Keep honest copy: only YouTube is OAuth-backed right now

- [ ] **Step 3: Update settings page orchestration**

In `dashboard/src/app/dashboard/settings/page.tsx`:

- fetch provider capability data alongside connections
- pass an `onOAuthConnect` handler to the component
- redirect the browser to the returned provider URL
- optionally surface success/error query params after callback return

- [ ] **Step 4: Run dashboard build verification**

Run: `npm run build --prefix dashboard`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/lib/api.ts dashboard/src/components/platform-connect.tsx dashboard/src/app/dashboard/settings/page.tsx
git commit -m "feat: add youtube oauth dashboard flow"
```

## Task 5: Protect the existing Privy + agentic-wallet boundaries

**Files:**

- Modify: `src/api/routes/platforms.ts` (only if metadata/creator checks need tightening)
- Modify: `docs/superpowers/plans/2026-03-18-indyfren-mvp.md`
- Test: `tests/unit/api/platform-oauth.test.ts`, `tests/unit/api/platforms.test.ts`, `tests/unit/wallet/mpp.test.ts`

- [ ] **Step 1: Verify the OAuth flow does not bypass Privy creator auth**

Confirm in code and tests:

- only authenticated Privy users can initiate OAuth
- callback state ties the provider response back to the Privy-resolved creator
- no wallet provisioning or wallet mutation happens during platform OAuth

- [ ] **Step 2: Add or extend regression coverage where needed**

Add assertions that:

- OAuth writes platform credentials only through the encrypted connection path
- existing wallet tests still pass untouched
- callback failures redirect cleanly without partial persistence

- [ ] **Step 3: Run the backend verification gate**

Run:

```bash
npm test -- tests/unit/api/platform-oauth.test.ts tests/unit/api/platforms.test.ts tests/unit/wallet/mpp.test.ts
npm run build
```

Expected: PASS

- [ ] **Step 4: Update the main implementation log**

In `docs/superpowers/plans/2026-03-18-indyfren-mvp.md`, update:

- shipped in latest slice
- remaining gaps
- verification counts
- note that Privy remains the creator identity + agentic wallet layer

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-03-18-indyfren-mvp.md
git commit -m "docs: record youtube oauth milestone"
```

## Task 6: Manual verification and rollout notes

**Files:**

- Modify: `README.md` if needed
- Modify: `.env.example` if clarification is missing

- [ ] **Step 1: Dry-run configuration check**

Set:

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `YOUTUBE_OAUTH_REDIRECT_URI`
- `DASHBOARD_APP_URL`

Run:

```bash
npm run smoke:preflight
```

Expected: existing checks PASS; OAuth envs are configured manually for this slice even if preflight is not extended yet

- [ ] **Step 2: Manual YouTube OAuth smoke flow**

1. Start backend: `npm run dev`
2. Start dashboard: `npm run dashboard:dev`
3. Sign into dashboard with Privy
4. Open settings
5. Click `Connect with Google` under YouTube
6. Complete Google consent
7. Confirm redirect back to `/dashboard/settings?oauth=success&platform=youtube`
8. Confirm YouTube shows connected in the UI

- [ ] **Step 3: Failure-path smoke**

Verify:

- callback with tampered `state` redirects with `oauth=error`
- provider denial redirects with `oauth=error`
- missing OAuth env config makes YouTube OAuth unavailable or returns a clear backend error

- [ ] **Step 4: Optional README follow-up**

If the flow is working and stable, add a short “YouTube OAuth setup” section to `README.md`.

## Notes for the Implementer

- Do **not** alter `src/wallet/privy.ts` or `src/wallet/privy-provisioning.ts` for this feature unless a regression forces it. OAuth is not a wallet feature.
- Do **not** add long-lived in-memory OAuth state. The bot and API are already designed to survive restarts; the OAuth flow should too.
- Do **not** expose provider client secrets or provider access tokens to the dashboard.
- Do **not** claim multi-provider OAuth is shipped when only YouTube is implemented.
- If Google/YouTube profile lookup proves brittle, store the connection even when username resolution fails, but still persist the platform user id when available.
