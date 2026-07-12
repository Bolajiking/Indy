# Test Results - Indyfren Launch Verification

**Date:** July 3, 2026

**Tester:** Codex (automated)

**Environment:** Local development (macOS)

## Executive Summary

**Overall status: automated launch contract passing; staging and live smoke pending.**

Indyfren is preparing for a public sandbox beta. These results establish local automated health only. They do not approve a consumer production deployment.

- **77/77 test files passing**
- **352/352 tests passing**
- **Backend TypeScript build passing**
- **Dashboard Next.js 15 production build passing**
- **Prettier check passing for `src/**/*.ts` and `tests/**/*.ts`**
- **Root audit passing at the moderate threshold**
- **Dashboard audit passing at the high threshold**

## Shared Verification Contract

The local and CI contract is:

```bash
npm run verify
```

It runs, in order:

1. `npm test`
2. `npm run build`
3. `npm run dashboard:build`
4. `npx prettier --check 'src/**/*.ts' 'tests/**/*.ts'`
5. `npm audit --audit-level=moderate`
6. `npm audit --audit-level=high --prefix dashboard`

Tests use non-secret CI placeholders when real service credentials are not required:

```bash
ANTHROPIC_API_KEY=ci-placeholder \
SUPABASE_URL=https://supabase.com \
SUPABASE_SERVICE_KEY=ci-placeholder \
PRIVY_APP_ID=ci-placeholder \
PRIVY_APP_SECRET=ci-placeholder \
PRIVY_JWT_VERIFICATION_KEY=ci-placeholder \
MESSAGING_LINK_SECRET=ci-placeholder \
NODE_ENV=test \
npm run verify
```

## Dependency Status

The non-breaking remediation updated vulnerable transitive dependencies and did not use `npm audit fix --force`.

### Root

- The blocking command `npm audit --audit-level=moderate` passes.
- Hono, Undici, and js-yaml were updated to patched versions.
- `ws` is pinned to patched `8.21.0` through an override because its reachable runtime paths are `@privy-io/node -> viem -> ws` and `mppx -> viem -> ws` in wallet authentication/payment code. Review by **August 3, 2026**; remove the override once both owning dependency trees resolve to a non-vulnerable `ws` without it and the root moderate audit still passes.
- One low-severity esbuild development-server advisory remains below the blocking threshold. It concerns arbitrary file reads from the development server on Windows and is not part of the deployed Node server runtime.

### Dashboard

- The blocking command `npm audit --audit-level=high --prefix dashboard` passes.
- form-data and Hono high-severity findings were remediated. Hono is pinned to patched `4.12.27` because the dashboard reaches it through `@privy-io/react-auth -> x402 -> wagmi -> @wagmi/connectors -> porto -> hono`. Review by **August 3, 2026**; remove the override once that upstream tree resolves to a patched Hono without it and the dashboard high audit still passes.
- Two moderate findings remain for PostCSS bundled inside Next.js. npm offers only a forced breaking downgrade, so the high threshold remains enforced while the team tracks a safe Next.js release.

## Build and Format Results

| Gate | Result |
| --- | --- |
| Backend `tsc` build | Pass |
| Dashboard Next.js build | Pass |
| Prettier scoped check | Pass |
| `git diff --check` | Pass |

The formatting change is mechanical and limited to the 14 TypeScript files identified by the baseline Prettier check.

## Live-Smoke State

The following deployment-backed checks are still required before opening the public sandbox beta:

1. Run `npm run smoke:preflight` with the actual staging environment and resolvable Supabase host.
2. Run `node --import tsx scripts/smoke-health.ts` against the staged backend and dashboard.
3. Run `npm run smoke:auth` with a current Privy bearer token, including the dashboard proxy check.
4. Apply the `payment_attempts` migration to the live Supabase database if it is still absent.
5. Run `npm run test:mpp` with a Privy-backed creator whose Tempo sandbox wallet has enough pathUSD to settle the paid request.

The last recorded live MPP attempt reached Tempo payment execution but failed with `InsufficientBalance`. The last recorded database check also found the live `payment_attempts` table absent and the configured direct database host unresolved from the test machine. Neither condition is cleared by this automated verification pass.

## Release Decision

- **Automated contract:** Pass
- **Public sandbox beta:** Blocked on complete staging smoke
- **General availability / consumer production:** Not approved

The CI deploy jobs now depend on the security job in addition to test/build/smoke contract jobs, so an audit failure blocks deployment.
