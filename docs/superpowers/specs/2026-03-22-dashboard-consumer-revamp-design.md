# Dashboard Consumer Revamp Design

**Date:** 2026-03-22

**Status:** Approved in-session direction, ready for implementation planning

## Goal

Revamp the Indyfren dashboard so it feels consumer-ready for creators, using clearer product language, stronger CTA hierarchy, and a proper desktop chat experience that makes the dashboard feel like a daily workspace rather than an internal console.

## Product Direction

The dashboard should feel like a creator-friendly coach:

- warm and supportive
- clear and low-friction
- polished and trustworthy
- not overly technical
- not overly “operator/admin” in tone

The chosen experience direction is:

- **Layout:** Balanced hybrid
- **Primary dashboard focus:** Today’s priorities and approvals
- **Visual direction:** Clean product
- **Voice:** Creator-friendly coach

## Experience Principles

1. **Lead with what matters now**
   The first thing a creator sees should be what needs attention today, not raw system state or backend-shaped metrics.

2. **Make chat a real workspace**
   The dashboard chat must feel like a core product surface with enough space to think, review, and act, not a compact support widget.

3. **Use app language, not system language**
   Replace implementation-centric wording like “authenticated routes,” “creator session,” and “wallet provisioning pending” with plain-language product copy.

4. **Keep the dashboard scannable**
   A creator should be able to understand the state of their business in under 10 seconds.

5. **Keep the UI fast and stable**
   Rendering should remain deterministic and hydration-safe, with stable SSR output and no unnecessary layout shifts.

## Chosen Layout

### 1. Top band: “Today” workspace hero

The first section of `/dashboard` should become a “Today” area that answers:

- What needs my attention?
- What should I do next?
- Which actions matter most right now?

Structure:

- left: main narrative panel
  - heading focused on today’s priorities
  - short summary of approvals, follow-ups, and opportunities
  - 2 primary actions:
    - `Review approvals`
    - `See opportunities`
- right: compact status cards
  - approvals waiting
  - deal follow-ups
  - wallet/spend readiness

This should replace the current “command center” framing and the more internal-feeling status language.

### 2. Main working band: chat + support rail

The second major section should be the primary work area.

Structure:

- left column: full `AgentConsole`
- right column: supporting operational context
  - current opportunities
  - recent activity
  - connected channels / messaging context

Recommended desktop ratio:

- `1.05fr / 0.95fr` or similar, with the chat side visually dominant

Recommended chat dimensions:

- visible message area target height: `420px` to `460px`
- persistent composer pinned at the bottom of the chat card
- enough width for multi-line assistant replies and action previews

### 3. Supporting insights

Supporting cards or analytics should be visually lower priority than the “Today” band and the chat workspace. They should support action, not compete with it.

## Chat Interface Design

The dashboard chat should be redesigned as a polished assistant interface.

### Chat structure

- clear header:
  - title: `Chat with Indyfren`
  - support copy: a short statement about what the assistant can help with
- quick prompt chips under the header
- large scrollable conversation area
- clearly differentiated bubbles:
  - creator messages
  - agent messages
  - approval-related responses
- pinned composer with a comfortable input height

### Chat copy direction

- title: `Chat with Indyfren`
- helper copy:
  - `Ask for help with deals, pitches, approvals, payouts, or planning your next move.`
- composer placeholder:
  - `Ask Indyfren to review a deal, draft a reply, explain your numbers, or plan your day`

### Quick prompts

Replace the current more mechanical prompts with warmer product prompts:

- `Plan my day`
- `Check my deals`
- `Show wallet activity`
- `Draft a sponsor reply`

### Approval UX

Approvals should remain visible in the side panel, but the chat should also make “approval required” moments feel natural and understandable, not like a low-level tool state.

## Copy and CTA Revamp

## Voice rules

- prefer direct plain English
- prefer outcome-focused wording
- avoid implementation terms unless necessary
- keep a calm, helpful tone
- use short buttons with familiar verbs

## Button/CTA system

### Primary CTA style

Used for the most important action in a section:

- `Review approvals`
- `Ask Indyfren`
- `Save changes`
- `Connect Telegram`

### Secondary CTA style

Used for lower-emphasis actions:

- `Refresh`
- `Try again`
- `View all`
- `Skip for now`

### Destructive/edge actions

Keep explicit, but calm:

- `Disconnect`
- `Sign out`

## Example copy shifts

### Shell

- `Creator desk` → `Your workspace`
- `Indyfren Console` → `Indyfren`

### Dashboard overview

- `A calm command center for messy creator revenue.` →
  `Everything you need to run your creator business in one place.`

- `Live creator connected` →
  `You’re all set for today`

- `Awaiting authenticated creator session` →
  `Sign in to open your workspace`

### Onboarding/auth states

- `Authenticate to unlock your creator data.` →
  `Sign in to open your creator workspace.`

- `The backend now serves creator data only through bearer-authenticated routes.` →
  `Sign in with Privy to access your deals, messages, wallet, and approvals.`

### Wallet/setup language

- `Wallet provisioning is still pending.` →
  `Your wallet is still getting set up. You can keep using the app while we finish that in the background.`

### Platform/channel setup

- `Could not complete YouTube OAuth` →
  `We couldn’t connect YouTube right now. Try again in a moment.`

- `Telegram linking instructions are ready.` →
  `Your Telegram connection steps are ready.`

## Visual Direction

The visual system should stay within the existing Indyfren palette, but move closer to a polished product feel.

### Keep

- the warm paper/parchment palette
- the serif display accent
- the soft editorial warmth

### Adjust

- stronger structure and spacing
- clearer button hierarchy
- less “dense dashboard card pile” feeling
- cleaner visual grouping between priority, chat, and support content
- fewer copy-heavy blocks

### UI emphasis

- hero and chat get the most visual weight
- support rail stays useful but quieter
- metrics become informative, not dominant

## Scope

### In scope

- dashboard copy rewrite
- CTA/button hierarchy cleanup
- `/dashboard` overview layout redesign
- `AgentConsole` visual and interaction redesign
- settings/onboarding language cleanup where it affects consumer readiness
- wallet/reports copy cleanup where needed for consistency
- deterministic rendering and hydration-safe formatting for any new display logic

### Out of scope

- changing backend route contracts
- changing auth architecture
- changing wallet provisioning logic
- changing data models
- adding new platform integrations
- redesigning every route from scratch in this pass

## Implementation Boundaries

Expected primary files:

- `dashboard/src/app/dashboard/page.tsx`
- `dashboard/src/components/agent-console.tsx`
- `dashboard/src/app/dashboard/layout.tsx`
- `dashboard/src/components/dashboard-auth-gate.tsx`
- `dashboard/src/app/dashboard/settings/page.tsx`
- `dashboard/src/app/dashboard/wallet/page.tsx`
- `dashboard/src/app/dashboard/reports/page.tsx`
- `dashboard/src/app/globals.css`

Likely supporting helpers:

- dashboard UI text helpers if useful
- shared button/panel utility classes in CSS

## Performance and Rendering Constraints

The revamp must not regress rendering stability.

### Constraints

- keep SSR output deterministic
- do not use locale-dependent formatting in server-rendered content unless normalized
- avoid introducing avoidable hydration mismatches
- avoid heavy client-only layout logic that causes flicker
- avoid giant DOM trees inside the chat surface

### Practical guidance

- use deterministic formatting helpers for times/dates/numbers
- prefer stable layout dimensions for the chat surface
- avoid layout jumps when loading auth or query data
- avoid over-animating first render

## Testing Expectations

Implementation should include:

- unit tests for any new copy/formatting helpers
- regression tests for any new dashboard state handling if logic changes
- dashboard production build verification
- manual browser check for:
  - `/dashboard`
  - `/dashboard/settings`
  - `/dashboard/wallet`
  - `/dashboard/reports`
- visual verification of:
  - chat dimensions on desktop
  - CTA hierarchy
  - empty states
  - authenticated and wallet-pending states

## Success Criteria

The revamp is successful when:

- the dashboard reads like a creator product, not an internal tool
- the top of the page clearly tells a creator what matters today
- the chat area feels like a proper work surface on desktop
- buttons and CTAs are consistent and understandable
- auth/onboarding/setup copy is clearer and less technical
- the dashboard remains hydration-safe and visually stable
