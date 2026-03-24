# Dashboard Consumer Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Indyfren dashboard into a consumer-ready creator workspace with clearer product copy, stronger CTA hierarchy, and a larger desktop chat experience that feels like a real working surface.

**Architecture:** Keep the existing dashboard route structure, auth flow, and backend APIs intact. The revamp stays frontend-only: consolidate `/dashboard` data loading into a single combined client query, extract focused presentational sections for the home hero and support rail, and centralize creator-facing copy so onboarding, settings, wallet, and reports all speak the same product language.

**Tech Stack:** Next.js 15 app router, React 19 client components, Tailwind CSS, existing dashboard auth/query helpers (`useAuth`, `useAuthedQuery`), Vitest for pure helper tests.

---

## File Map

### Create

- `dashboard/src/lib/dashboard-home.ts`
  - Combined home-page loader using `Promise.all(...)`
  - Pure view-model helpers for the “Today” hero, compact priority cards, support rail, and lower-priority insight cards
- `dashboard/src/lib/consumer-copy.ts`
  - Shared creator-facing copy helpers for shell status, onboarding states, settings summaries, and messaging/wallet phrasing
- `dashboard/src/components/dashboard-home-hero.tsx`
  - “Today” workspace hero with headline, summary, 2 primary CTAs, and compact status cards
- `dashboard/src/components/dashboard-support-rail.tsx`
  - Right-hand support rail for opportunities, recent activity, and connected channels
- `tests/unit/dashboard/home-state.test.ts`
  - Unit coverage for `buildDashboardHomeModel(...)`
- `tests/unit/dashboard/consumer-copy.test.ts`
  - Unit coverage for copy helpers used by layout/auth/settings flows

### Modify

- `dashboard/src/app/dashboard/page.tsx`
  - Replace the metrics-first layout with the approved balanced-hybrid structure
  - Consume `fetchDashboardHome(...)` instead of scattering multiple ad hoc queries
- `dashboard/src/components/agent-console.tsx`
  - Upgrade from compact utility panel to full agent workspace with stable dimensions, clearer bubbles, pinned composer, quick prompts, and integrated approval context
- `dashboard/src/app/dashboard/layout.tsx`
  - Rewrite shell/nav/status copy to sound like a creator product, not an internal console
- `dashboard/src/components/dashboard-auth-gate.tsx`
  - Rewrite sign-in, registration, and wallet-pending states in creator-friendly product language
- `dashboard/src/components/profile-settings-form.tsx`
  - Tighten profile copy, labels, success states, and wallet status framing
- `dashboard/src/components/platform-connect.tsx`
  - Rewrite platform connection instructions, CTA labels, and manual-entry guidance to be consumer-friendly
- `dashboard/src/app/dashboard/settings/page.tsx`
  - Align settings page hero, messaging-link instructions, and spend-limit copy with the new voice
- `dashboard/src/app/dashboard/wallet/page.tsx`
  - Reframe wallet page toward creator understanding and readiness
- `dashboard/src/app/dashboard/reports/page.tsx`
  - Reframe reports page language so it reads like business insights instead of raw finance/admin output
- `dashboard/src/app/globals.css`
  - Add a small set of reusable button/surface utilities to keep CTAs, cards, and chat sections visually consistent

### Verify

- `npm test -- tests/unit/dashboard/home-state.test.ts tests/unit/dashboard/consumer-copy.test.ts tests/unit/dashboard/datetime.test.ts`
- `npm run build --prefix dashboard`
- `npm test`

## Task 1: Build the home-page data model and loader

**Files:**
- Create: `dashboard/src/lib/dashboard-home.ts`
- Create: `tests/unit/dashboard/home-state.test.ts`
- Modify: `dashboard/src/app/dashboard/page.tsx`

- [ ] **Step 1: Write the failing home-state tests**

Create `tests/unit/dashboard/home-state.test.ts` with focused cases for:

```ts
import { describe, expect, it } from "vitest";

import { buildDashboardHomeModel } from "../../../dashboard/src/lib/dashboard-home";

describe("buildDashboardHomeModel", () => {
  it("summarizes approvals, follow-ups, and wallet readiness for the Today hero", () => {
    const model = buildDashboardHomeModel({
      deals: [
        { id: "1", brand_name: "Acme", stage: "negotiating", fit_score: 92, estimated_value_cents: 250000, notes: "Need a reply" },
      ],
      transactions: [],
      agentState: {
        messages: [],
        pendingApprovals: [
          {
            id: "p1",
            creatorId: "c1",
            actionId: "a1",
            type: "email",
            description: "Send sponsor reply",
            preview: "Draft sponsor reply",
            input: {},
          },
        ],
      },
      connections: [{ platform: "telegram", platform_username: "indycreator", connected: true }],
    });

    expect(model.hero.primaryCta.label).toBe("Review approvals");
    expect(model.hero.cards[0]?.value).toBe("1");
    expect(model.supportRail.channels[0]?.label).toBe("Telegram");
  });

  it("returns calm empty states when there is no creator activity yet", () => {
    const model = buildDashboardHomeModel({
      deals: [],
      transactions: [],
      agentState: { messages: [], pendingApprovals: [] },
      connections: [],
    });

    expect(model.hero.title).toContain("today");
    expect(model.supportRail.opportunities[0]?.title).toContain("No opportunities yet");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/unit/dashboard/home-state.test.ts`

Expected: FAIL because `dashboard/src/lib/dashboard-home.ts` does not exist yet.

- [ ] **Step 3: Implement the combined loader and view model**

Create `dashboard/src/lib/dashboard-home.ts` with:

```ts
import {
  fetchAgentState,
  fetchConnections,
  fetchDeals,
  fetchTransactions,
  type DashboardAgentState,
  type DashboardDeal,
  type DashboardPlatformConnection,
  type DashboardTransaction,
} from "@/lib/api";

export interface DashboardHomeData {
  deals: DashboardDeal[];
  transactions: DashboardTransaction[];
  agentState: DashboardAgentState;
  connections: DashboardPlatformConnection[];
}

export async function fetchDashboardHome(accessToken: string): Promise<DashboardHomeData> {
  const [deals, transactions, agentState, connections] = await Promise.all([
    fetchDeals(accessToken),
    fetchTransactions(accessToken),
    fetchAgentState(accessToken),
    fetchConnections(accessToken),
  ]);

  return { deals, transactions, agentState, connections };
}

export function buildDashboardHomeModel(data: DashboardHomeData) {
  // Return a stable, presentation-friendly object for the hero, support rail,
  // and secondary insight cards. Keep string formatting deterministic.
}
```

Design rules:
- Keep formatting deterministic; reuse existing currency/date helpers instead of ad hoc locale calls.
- Derive counts once in the helper instead of recomputing in JSX.
- Keep empty-state copy calm and product-facing.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/unit/dashboard/home-state.test.ts`

Expected: PASS.

- [ ] **Step 5: Update the dashboard page to use the new loader shape**

Replace multiple `useAuthedQuery(...)` calls in `dashboard/src/app/dashboard/page.tsx` with one:

```ts
const { data, error, isLoading } = useAuthedQuery(fetchDashboardHome, EMPTY_HOME_DATA);
const model = buildDashboardHomeModel(data);
```

Keep the page compiling even before the new hero/support components exist by temporarily rendering `model` values inline or leaving TODO placeholders inside the file.

- [ ] **Step 6: Build the dashboard to verify the page still compiles**

Run: `npm run build --prefix dashboard`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add tests/unit/dashboard/home-state.test.ts dashboard/src/lib/dashboard-home.ts dashboard/src/app/dashboard/page.tsx
git commit -m "feat: add dashboard home view model"
```

## Task 2: Add shared consumer-ready copy helpers and shell styles

**Files:**
- Create: `dashboard/src/lib/consumer-copy.ts`
- Create: `tests/unit/dashboard/consumer-copy.test.ts`
- Modify: `dashboard/src/app/dashboard/layout.tsx`
- Modify: `dashboard/src/app/globals.css`

- [ ] **Step 1: Write the failing copy-helper tests**

Create `tests/unit/dashboard/consumer-copy.test.ts` with cases like:

```ts
import { describe, expect, it } from "vitest";

import {
  getDashboardShellCopy,
  getSignedOutCopy,
  getWalletPendingCopy,
} from "../../../dashboard/src/lib/consumer-copy";

describe("consumer dashboard copy", () => {
  it("uses creator-friendly shell language", () => {
    expect(getDashboardShellCopy().title).toBe("Your workspace");
  });

  it("keeps wallet pending language calm and action-oriented", () => {
    expect(getWalletPendingCopy({ inProgress: true, lastError: null })).toContain("background");
  });

  it("avoids technical auth phrasing on the signed-out state", () => {
    expect(getSignedOutCopy().detail).not.toContain("authenticated routes");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/unit/dashboard/consumer-copy.test.ts`

Expected: FAIL because `dashboard/src/lib/consumer-copy.ts` does not exist yet.

- [ ] **Step 3: Implement shared copy helpers**

Create `dashboard/src/lib/consumer-copy.ts` with small pure helpers for:

```ts
export function getDashboardShellCopy() {
  return {
    eyebrow: "Indyfren",
    title: "Your workspace",
    description: "Keep your deals, approvals, messages, and connected channels in one place.",
  };
}

export function getSignedOutCopy() {
  return {
    eyebrow: "Sign in required",
    title: "Sign in to open your workspace",
    detail: "Use Privy to access your deals, messages, wallet activity, and approvals.",
    actionLabel: "Sign in with Privy",
  };
}

export function getWalletPendingCopy(input: {
  inProgress: boolean;
  lastError: string | null;
}) {
  // Return the new creator-friendly wallet language used across the app.
}
```

- [ ] **Step 4: Add reusable dashboard utility classes**

Update `dashboard/src/app/globals.css` with a very small utility layer for the revamp:

```css
.cta-primary { @apply rounded-full bg-ink px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-paper transition hover:bg-plum; }
.cta-secondary { @apply rounded-full border border-black/10 bg-white px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-ink transition hover:bg-parchment; }
.surface-card { @apply rounded-[28px] border border-black/10 bg-white/75 shadow-card; }
.surface-muted { @apply rounded-[22px] border border-black/10 bg-parchment; }
```

Keep the additions minimal; do not replace Tailwind with a large custom design system.

- [ ] **Step 5: Rework the shell layout copy**

Update `dashboard/src/app/dashboard/layout.tsx` to:
- change `Indyfren Console` to `Indyfren`
- change `Creator desk` to `Your workspace`
- rewrite the body copy around one simple promise
- use `consumer-copy.ts` for status strings instead of inline stage-specific prose
- keep the mounted-pathname hydration fix exactly as-is

- [ ] **Step 6: Run focused tests and build**

Run:
- `npm test -- tests/unit/dashboard/consumer-copy.test.ts`
- `npm run build --prefix dashboard`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add tests/unit/dashboard/consumer-copy.test.ts dashboard/src/lib/consumer-copy.ts dashboard/src/app/dashboard/layout.tsx dashboard/src/app/globals.css
git commit -m "feat: refresh dashboard shell language"
```

## Task 3: Rebuild `/dashboard` into the balanced-hybrid home layout

**Files:**
- Create: `dashboard/src/components/dashboard-home-hero.tsx`
- Create: `dashboard/src/components/dashboard-support-rail.tsx`
- Modify: `dashboard/src/app/dashboard/page.tsx`
- Modify: `dashboard/src/lib/dashboard-home.ts`

- [ ] **Step 1: Extend the home-state test to cover hero and rail data**

Add test cases in `tests/unit/dashboard/home-state.test.ts` for:
- hero title/subtitle selection
- compact stat cards (`approvals`, `follow-ups`, `wallet activity`)
- support rail sections (`opportunities`, `recent activity`, `connected channels`)
- lower-priority insight cards staying out of the hero payload

- [ ] **Step 2: Run the test to verify the new cases fail**

Run: `npm test -- tests/unit/dashboard/home-state.test.ts`

Expected: FAIL until the view model exposes the new shape.

- [ ] **Step 3: Expand `dashboard-home.ts` to match the approved layout**

Add explicit shapes such as:

```ts
export interface DashboardHomeModel {
  hero: {
    title: string;
    summary: string;
    primaryCta: { label: string; href: string };
    secondaryCta: { label: string; href: string };
    cards: Array<{ label: string; value: string; detail: string }>;
  };
  supportRail: {
    opportunities: Array<{ title: string; stage: string; value: string }>;
    activity: Array<{ title: string; detail: string; timestamp: string }>;
    channels: Array<{ label: string; detail: string; status: "connected" | "not_connected" }>;
  };
  insights: Array<{ label: string; value: string; detail: string }>;
}
```

Use the current data only; do not add new backend fields.

- [ ] **Step 4: Build the hero component**

Create `dashboard/src/components/dashboard-home-hero.tsx` that renders:
- `Today` eyebrow
- human headline and summary
- two CTAs: `Review approvals` and `See opportunities`
- three compact status cards aligned to the right on desktop

Keep buttons wired as links/buttons only where the current routes already exist.

- [ ] **Step 5: Build the support rail component**

Create `dashboard/src/components/dashboard-support-rail.tsx` for:
- `Current opportunities`
- `Recent activity`
- `Connected channels`

Rules:
- keep it visually quieter than the chat panel
- prefer 2-3 items per section max
- keep empty states short

- [ ] **Step 6: Replace the current home layout**

Update `dashboard/src/app/dashboard/page.tsx` to render:

```tsx
<DashboardHomeHero model={model.hero} />
<section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
  <AgentConsole />
  <DashboardSupportRail model={model.supportRail} />
</section>
<section>{/* lower-priority insight cards */}</section>
```

Remove the current “command center” hero, old status card wording, and the current duplicated metrics/pipeline-first layout.

- [ ] **Step 7: Run the tests and build**

Run:
- `npm test -- tests/unit/dashboard/home-state.test.ts`
- `npm run build --prefix dashboard`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add dashboard/src/components/dashboard-home-hero.tsx dashboard/src/components/dashboard-support-rail.tsx dashboard/src/app/dashboard/page.tsx dashboard/src/lib/dashboard-home.ts tests/unit/dashboard/home-state.test.ts
git commit -m "feat: redesign dashboard home layout"
```

## Task 4: Turn the chat panel into a real desktop workspace

**Files:**
- Modify: `dashboard/src/components/agent-console.tsx`

- [ ] **Step 1: Capture the chat-layout requirements directly in the component**

Before editing, add comments or TODO markers only if needed to preserve the required constraints:
- visible message area target height `420px` to `460px`
- pinned composer
- quick prompts directly under the header
- clear bubble differentiation for creator vs agent
- approvals integrated visually without removing the separate approval list

Do not leave stray TODO comments in the final code.

- [ ] **Step 2: Refactor the component structure without changing its API contract**

Reshape `dashboard/src/components/agent-console.tsx` into:
- header area with `Chat with Indyfren`
- helper copy: `Ask for help with deals, pitches, approvals, payouts, or planning your next move.`
- quick prompt chips using:
  - `Plan my day`
  - `Check my deals`
  - `Show wallet activity`
  - `Draft a sponsor reply`
- larger conversation surface
- pinned composer/footer action row
- quieter approval column with clearer product wording

Keep existing data hooks (`fetchAgentState`, `sendAgentMessage`, `approveAgentAction`, `skipAgentAction`) unchanged.

- [ ] **Step 3: Apply the copy and CTA rewrite inside chat**

Replace:
- `Agent console` → `Agent workspace` or remove the extra eyebrow if the header already carries the page well
- `Send to agent` → `Ask Indyfren`
- `Refresh thread` → `Refresh`
- system-heavy banners with calmer product copy

Preserve all current error handling and wallet-pending guidance, but rewrite it in plain language.

- [ ] **Step 4: Tighten spacing, overflow, and composer behavior**

Implementation targets:
- stable outer card height on desktop
- `overflow-y-auto` only on the message region
- composer separated by a top border or surface shift
- approval cards still visible and actionable on the right

Do not introduce client-only measurements or random values; keep render deterministic.

- [ ] **Step 5: Run the dashboard build**

Run: `npm run build --prefix dashboard`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/components/agent-console.tsx
git commit -m "feat: upgrade agent console workspace"
```

## Task 5: Rewrite onboarding, settings, wallet, reports, and platform connection copy

**Files:**
- Modify: `dashboard/src/components/dashboard-auth-gate.tsx`
- Modify: `dashboard/src/components/profile-settings-form.tsx`
- Modify: `dashboard/src/components/platform-connect.tsx`
- Modify: `dashboard/src/app/dashboard/settings/page.tsx`
- Modify: `dashboard/src/app/dashboard/wallet/page.tsx`
- Modify: `dashboard/src/app/dashboard/reports/page.tsx`
- Modify: `dashboard/src/lib/consumer-copy.ts`

- [ ] **Step 1: Extend the copy-helper tests for onboarding and settings states**

Add cases in `tests/unit/dashboard/consumer-copy.test.ts` for:
- signed-out card title/detail/action
- registration state wording
- wallet-pending copy with and without last error
- settings/messaging instructions staying non-technical

- [ ] **Step 2: Run the test to verify the new cases fail**

Run: `npm test -- tests/unit/dashboard/consumer-copy.test.ts`

Expected: FAIL until the helpers and call sites are updated.

- [ ] **Step 3: Update `dashboard-auth-gate.tsx`**

Rewrite:
- `Authenticate to unlock your creator data.` → `Sign in to open your workspace`
- `Create your creator desk.` → `Create your profile`
- wallet-pending language to emphasize “you can keep using the app while we finish setup”

Keep the same branching logic and retry hooks.

- [ ] **Step 4: Update profile/settings/platform copy**

Change the phrasing in:
- `dashboard/src/components/profile-settings-form.tsx`
- `dashboard/src/components/platform-connect.tsx`
- `dashboard/src/app/dashboard/settings/page.tsx`

Direction:
- product-facing labels
- simpler explanations of spend controls
- approachable Telegram/WhatsApp linking instructions
- clearer YouTube OAuth fallback wording without exposing internal implementation detail

- [ ] **Step 5: Update wallet and reports copy**

Rewrite `dashboard/src/app/dashboard/wallet/page.tsx` and `dashboard/src/app/dashboard/reports/page.tsx` so they read like creator business pages:
- wallet: readiness, funding, activity trail, spend summary
- reports: business snapshot, audience growth, connected platform insight

Do not change the underlying calculations.

- [ ] **Step 6: Run tests and build**

Run:
- `npm test -- tests/unit/dashboard/consumer-copy.test.ts tests/unit/dashboard/datetime.test.ts`
- `npm run build --prefix dashboard`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add dashboard/src/components/dashboard-auth-gate.tsx dashboard/src/components/profile-settings-form.tsx dashboard/src/components/platform-connect.tsx dashboard/src/app/dashboard/settings/page.tsx dashboard/src/app/dashboard/wallet/page.tsx dashboard/src/app/dashboard/reports/page.tsx dashboard/src/lib/consumer-copy.ts tests/unit/dashboard/consumer-copy.test.ts
git commit -m "feat: rewrite creator-facing dashboard copy"
```

## Task 6: Final verification and finish pass

**Files:**
- Modify: `docs/superpowers/plans/2026-03-18-indyfren-mvp.md` (only if the repo’s running implementation log should mention the completed dashboard revamp)

- [ ] **Step 1: Run the targeted dashboard tests**

Run:

```bash
npm test -- tests/unit/dashboard/home-state.test.ts tests/unit/dashboard/consumer-copy.test.ts tests/unit/dashboard/datetime.test.ts tests/unit/dashboard/auth-state.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run the dashboard production build**

Run:

```bash
npm run build --prefix dashboard
```

Expected: PASS.

- [ ] **Step 3: Run the full repo test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 4: Manual QA in the running app**

Check these flows in the browser:
- signed-out dashboard shell
- unregistered creator onboarding card
- wallet-pending creator state
- active creator `/dashboard` home
- settings copy and platform connection CTAs
- wallet and reports pages

Manual acceptance checklist:
- home page loads with one clear “Today” hero and no duplicate metric overload
- chat occupies the dominant workspace area on desktop
- buttons and empty states read like consumer product language
- no hydration warnings caused by new formatting logic
- no layout shifts from the new home query/model wiring

- [ ] **Step 5: Update the running implementation log if needed**

If the team is tracking completed slices in `docs/superpowers/plans/2026-03-18-indyfren-mvp.md`, add one bullet summarizing:
- consumer-ready dashboard home revamp
- upgraded chat workspace
- creator-facing copy pass

Skip this if the repo is intentionally keeping that plan frozen.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/plans/2026-03-18-indyfren-mvp.md
git commit -m "chore: document dashboard revamp progress"
```

If Step 5 is skipped, commit the finished product files instead:

```bash
git add -A
git commit -m "feat: ship dashboard consumer revamp"
```
