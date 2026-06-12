# Indyfren — Designer Handoff & Product Map

> **Purpose:** Give the design team everything needed to redesign Indyfren from the ground up — product context, every user flow, every screen, the current design system, content/voice, states, and known problems to solve. This is a map of _what exists today_ plus _what the redesign must account for_. It is not a prescription of the new visual direction; that is the design team's job.

> **Version:** 1.0 · Generated 2026-06-04 · Source branch: `codex-dashboard-consumer-revamp`

---

## 1. What Indyfren Is

**One-liner:** An AI business manager for independent content creators. It scouts brand deals, calculates rates, writes pitches, reviews contracts, and tracks revenue — autonomously, 24/7 — while keeping the creator in control via approvals.

**The core promise:** _"The first AI that works your deals."_ Not a chatbot that answers questions — an agent that takes real action on the creator's behalf (scans platforms, drafts and sends pitches, manages a deal pipeline, pays for services with its own wallet).

**Why it exists (the problem):**

- 57% of full-time creators earn below a living wage.
- Creators juggle 5–15 tools alone (DMs, invoices, contracts, taxes, analytics) with no team.
- 17% cite _missing brand deals_ as their #1 barrier — not because deals don't exist, but because no one is finding and closing them.
- $37B/yr flows into creator brand deals; fewer than 3% of creators get their fair share.

**The wedge:** Replace the 15–20% that traditional management/agencies take with software that does the same job for a subscription + small revenue share, and works while the creator sleeps.

**Business model (pricing shown in product today):**

- **Free** — $10 in agent credits on signup, full access to all 12 skills, no card. _(This is the only tier currently active.)_
- **Pro** — "Coming soon": unlimited agent runs, advanced analytics, priority responses.
- (Architecture docs also describe future Starter $29 / Pro $79 / Business $199 tiers + 3% revenue share — **not** built yet. Design should treat tiering as a near-future need.)

---

## 2. Who It's For (Personas)

The product is built for **independent content creators** — the first niche being YouTubers, TikTokers, Instagrammers, and podcasters. The onboarding wizard captures the real segmentation dimensions the product cares about:

| Dimension                       | Values captured in-product                                                                                                                            |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Niche**                       | Fashion & Style, Beauty, Tech, Gaming, Finance, Health & Fitness, Food & Cooking, Travel, Parenting, Education, Entertainment, Business (+ free text) |
| **Platforms**                   | Instagram, TikTok, YouTube, Twitter/X, LinkedIn, Twitch, Pinterest, Snapchat                                                                          |
| **Audience size**               | Under 1K · 1K–10K · 10K–50K · 50K–250K · 250K–1M · 1M+                                                                                                |
| **Experience with brand deals** | "Just starting out" (no deals) · "Some experience" (a few deals) · "Actively working with brands" (multiple in flight)                                |
| **Goals**                       | Find brand deals · Negotiate better rates · Review contracts · Track revenue · Manage inbox · Content strategy                                        |

**Three rough personas to design for:**

1. **The Aspiring (10K–50K, no deals yet).** Overwhelmed, doesn't know what to charge, has never pitched. Needs confidence and hand-holding; the "holy shit, it found me a deal" first-run moment is everything.
2. **The Hustler (50K–250K, some deals).** Already doing this manually and hates it. Wants leverage and time back. Will judge the product on whether the pipeline + pitches are actually good.
3. **The Pro (250K+, active).** Treats creation as a business, may already pay a manager. Needs trust (spending controls, audit trail), reporting, and reliability before they hand over accounts and a wallet.

**Critical trust context:** the agent is given access to social accounts (OAuth), email (read/send), financial data, business relationships, and a spending wallet. Every design decision around autonomy, approvals, spending limits, and transparency is a _trust_ decision. Treat trust as a first-class design surface, not an afterthought.

---

## 3. Brand, Voice & Tone (as built today)

- **Name:** Indyfren (logo lockup: lowercase "indyfren" in dashboard; "Indyfren" titlecase on marketing). Logo mark = gradient rounded square with a lowercase **i**.
- **Personality in copy:** Warm, plain-spoken, creator-peer ("Built for creators, by creators"), confident but not hypey. Action-oriented ("works your deals", "on the job", "your call").
- **Voice patterns observed:** Short declarative headlines; "you're always in control" reassurance; concrete dollar amounts and fit scores everywhere; emoji used heavily in the bot/chat surfaces (👋 💼 📊 💰 ☀️) but sparingly in the web dashboard.
- **Agent self-presentation:** First-person ("I scan…", "I drafted a pitch…"), names itself "Indyfren" in chat bubbles.

**Tone tension to resolve in redesign:** marketing site is bold/consumer (big gradient hero, social proof, FOMO ticker) while the dashboard is restrained/utilitarian (Apple-system font, muted greys, dense). The redesign should decide how much of the marketing energy carries into the product.

---

## 4. Product Surfaces

Indyfren is **multi-surface** and everything stays in sync (a deal approved on Telegram updates the dashboard instantly). Design must consider all four:

| Surface                            | Tech                    | Role                                                                          | In scope for redesign                          |
| ---------------------------------- | ----------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------- |
| **Marketing site** (`/`)           | Next.js page            | Acquisition, explain, convert to signup                                       | Yes — full redesign                            |
| **Web dashboard** (`/dashboard/*`) | Next.js 15 + Privy auth | The companion control center: pipeline, wallet, reports, settings, agent chat | Yes — primary focus                            |
| **Telegram bot**                   | grammY                  | Primary day-to-day interface ("meet creators where they are")                 | Visual/UX of message templates, inline buttons |
| **WhatsApp bot**                   | Meta Cloud API          | Same shared logic as Telegram                                                 | Same                                           |

> Architecture explicitly calls the web dashboard a **"companion, not primary"** surface — the chat bots are meant to be the daily driver. The redesign should clarify this relationship (is the dashboard becoming primary? The current `codex-dashboard-consumer-revamp` branch suggests a push to make the dashboard more consumer-grade).

---

## 5. Information Architecture / Sitemap

```
/                          Marketing landing (Nav, Hero+chat, Ticker, Problem,
                           Live Demo, How it works, Skills grid, Social proof,
                           Pricing, FAQ, Footer CTA, Footer)
│
└── /dashboard             "Today" — agent console + support rail + at-a-glance
    │                      (gated by auth state machine; onboarding wizard lives here)
    ├── /dashboard/deals     Deal pipeline (8-stage kanban) + pending approvals
    ├── /dashboard/wallet    Balance, address, spend log, transaction history
    ├── /dashboard/reports   Revenue (financial) + Audience (analytics)
    └── /dashboard/settings  Platform connections, spending limits, profile,
                             Telegram/WhatsApp linking, account summary
```

**Dashboard top nav tabs (in order):** Today · Deals · Wallet · Reports · Settings. Active tab uses pink accent. Profile avatar (gradient circle, initial) → dropdown with Settings / Sign out.

---

## 6. The Auth & Onboarding State Machine

This is the backbone of the whole logged-in experience. The dashboard renders different content based on a six-state machine (`resolveDashboardAuthStage`). **Design needs distinct treatments for each state.**

| Stage            | Meaning                                         | What the user sees today                                                                      |
| ---------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `loading`        | Session restoring                               | "Opening your workspace…" state card + Sign in fallback                                       |
| `signed_out`     | Not authenticated                               | "Sign in to open your dashboard" state card                                                   |
| `unregistered`   | Authed, no creator profile                      | **Onboarding Wizard** at step 1                                                               |
| `onboarding`     | Registered, profile incomplete                  | **Onboarding Wizard** resumed at step 2                                                       |
| `wallet_pending` | Profile done, wallet provisioning in background | "One last step — setting up your wallet" banner (dark gradient) + full dashboard still usable |
| `active`         | Fully ready                                     | Full dashboard                                                                                |

Key nuance: **the app is usable before the wallet finishes provisioning.** Users can chat, review drafts, and manage approvals while wallet setup runs in the background. Only _paid_ actions are gated. The redesign should make this "you can start now, wallet finishing" state feel reassuring, not broken.

### Onboarding Wizard (4 steps, lives inside the dashboard)

A progress-bar wizard (4 segments) shown to `unregistered`/`onboarding` users:

1. **Profile** — Creator name (required) + Niche (chip-select from 12 + free text). → registers the creator.
2. **Audience** — Platforms (multi chip-select) + follower range (chip-select) + current rate per post (optional $ input). Helper: "Leave blank if you're not sure — Indyfren will calculate a recommended rate."
3. **Business** — Experience level (3 large radio cards) + goals (multi chip-select) + monthly income target (optional $). CTA: **"Find my first opportunity →"**
4. **First Scan** — Animated "Scanning for opportunities…" sequence (4 pulsing steps: _Analysing your niche and platforms · Scanning brand landscape · Matching audience fit · Calculating your market rate_), then renders the agent's actual first reply (2–3 brand matches + recommended rate). CTA: **"Open my dashboard →"**

> **This is the single most important moment in the product** — the first-run "magic" where the agent returns real brand matches + a rate. The redesign should make this feel like a genuine reveal/payoff.

**Bot onboarding (parallel path):** New users who arrive via Telegram/WhatsApp get a 3-question conversational onboarding (niche → platforms → follower count) then an automatic first scan, with wallet provisioning kicked off in the background. Same intent, chat-native form.

---

## 7. Core User Flows

### Flow A — Acquisition → Signup (marketing site)

1. Land on `/`. Hero headline "The first AI that **works your deals.**" with a live **chat box** the visitor can type into (pre-filled prompts: "Find brand deals", "Draft a pitch", "What should I charge?", "Plan my day").
2. Visitor submits a prompt → query saved to `sessionStorage` → Privy login triggered → after auth, query carried into the dashboard agent console.
3. Supporting persuasion as they scroll: live ticker (47 deals today, $38K pipeline…), problem stats, an auto-streaming live demo of the agent answering, 3-step "how it works", 12-skill grid, social proof, pricing ($0 free), FAQ, final CTA.

### Flow B — First-run (new creator)

Signup → `unregistered` → Onboarding Wizard (steps 1–4) → first scan reveal → `wallet_pending`/`active` dashboard. Wallet provisions in background.

### Flow C — Daily driver: chat with the agent

On `/dashboard` ("Today"): the **Agent Console** is a chat panel. Quick-prompt chips ("Plan my day", "Check my deals", "Show wallet activity", "Draft a sponsor reply"). User sends a message → optimistic user bubble appears → "Indyfren is working…" status → agent reply. If the agent drafts an action needing sign-off, a **pending approval** card appears (Approve / Skip).

### Flow D — Deal pipeline management

1. Agent discovers deals → they appear in the **Discovered** column of the kanban (also surfaced in the "Today" support rail under Opportunities and in the hero's urgent items).
2. Creator advances deals through 8 stages via per-card CTAs. Each stage has a **primary** (move forward) and **secondary** (dismiss/lose) action:

   `discovered → pitched → responded → negotiating → contracted → active → completed` (plus `lost`, reachable from any stage; `lost → discovered` = "Reopen").

   Example CTAs: Discovered → "Pitch now →" / "Dismiss"; Negotiating → "Contract signed" / "Walk away"; Active → "Mark completed ✓".

3. Cards show: brand name, value (`~$X` estimated vs `$X` actual), brand contact, **fit score** (animated progress bar + %), notes, brand reply text, contract notes, pitch-sent timestamp, expand/collapse for detail.
4. Stage moves call the API and report failures inline ("Move failed").

### Flow E — Approvals (the trust loop)

Pending agent actions surface in **three places**, all consistent: the Agent Console (Today), the Support Rail (Today), and a dedicated banner on the Deals page. Each shows: action **type**, **description**, **preview** (truncated draft), **Approve** (green) / **Skip-or-Dismiss**. Approving may incur a cost, which is reported back (`"...($0.12)"`). On Telegram/WhatsApp the same approval arrives as a message with **✅ Send** / **❌ Skip** inline buttons.

### Flow F — Wallet & spend

Wallet page shows balance (sandbox/testnet USDC on Tempo), wallet address (copyable), total spent, and a transaction ledger. Every paid agent action (brand research, email send, contract review) is logged with status (**settled / pending / failed**), service, amount, and error text. Low-balance (<$5) and empty states prompt funding. The agent's spend is governed by limits the creator sets in Settings.

### Flow G — Connect platforms (fuel the intelligence)

Settings → Connected platforms. **YouTube** uses real OAuth (Google) end-to-end. Other platforms (Instagram, TikTok, Twitter/X, etc.) currently use a manual connect path. Connected platforms feed follower/engagement data into Reports and rate calculations. OAuth returns to settings with success/error messaging.

### Flow H — Spending controls

Settings → three enforced limits: **per-transaction** (default $5), **daily** (default $50), **monthly** (default $500). Saved limits are enforced automatically on every paid action.

### Flow I — Go mobile (link chat channels)

Settings → Telegram/WhatsApp → generates a one-time link command + launch URL (expiring). User sends the command to the bot → channel linked → can now approve deals and chat from their phone, in sync with the dashboard.

### Flow J — Reporting

Reports page → Revenue block (income, expenses, net, active deals, pipeline value, monthly forecast + confidence) and Audience block (total followers + per-platform follower/engagement). Empty states route the user to "Scan for brand deals" or "Connect a platform."

---

## 8. The 12 Agent Skills (feature inventory)

These are the capabilities marketed as "one agent, every job your team would do." Each is a routable skill (intent-classified via Claude Haiku) and most are also reachable by bot slash-command. Design needs to represent these both as _marketing features_ and as _things the agent visibly does_ in-product.

| Skill                | What it does (creator-facing)                           | Bot command |
| -------------------- | ------------------------------------------------------- | ----------- |
| Brand Deal Scanner   | Surfaces matching sponsors before your morning coffee   | `/scan`     |
| Rate Calculator      | Tells you exactly what to charge, backed by market data | `my rates`  |
| Pitch Generator      | Drafts personalized outreach in your voice              | (chat)      |
| Contract Reviewer    | Flags red flags, bad clauses, unfair terms              | (chat)      |
| Revenue Advisor      | Turns income data into a growth roadmap                 | (chat)      |
| Financial Tracker    | Reconciles every dollar in/out                          | `/finances` |
| Morning Brief        | Daily digest of deals, tasks, opportunities             | `/brief`    |
| Analytics Aggregator | Cross-platform stats in one view                        | (chat)      |
| Content Strategy     | Data-driven content ideas tied to top niches            | `/content`  |
| Inbox Triager        | Separates real brand opportunities from noise           | (chat)      |
| Calendar Manager     | Schedules deliverables, deadlines, check-ins            | `/calendar` |
| SEO Optimizer        | Makes content discoverable beyond your audience         | (chat)      |

Skills that produce _advice_ (rate, pitch, scan, contract, revenue, content) get 👍/👎 feedback buttons in chat — feedback that trains the agent's memory. **Design opportunity:** a consistent way to show "the agent is reasoning / which skill is active / rate this output" across surfaces.

---

## 9. Screen-by-Screen Spec (current build)

### 9.1 Marketing landing (`/`)

Single long scroll. Sections in order:

- **Nav** — sticky; logo, "How it works", "Pricing", "Sign in" (outline), "Get started free" (blue). Mobile hamburger.
- **Hero** — two-column. Left: uppercase eyebrow pill "The AI Business Manager for Creators", big headline with gradient-filled phrase, subhead, and the interactive chat box (tab chips + textarea + "Ask Indyfren →"). Right (desktop only): **animated activity cards** that cycle every 3.5s (brand match, contract review, morning brief, revenue, rate) + a pulsing "Indyfren is running for creators right now" live indicator.
- **Live ticker** — 4 animated stats (47 deals discovered today / 12 pitches this week / $38K in pipeline / 207M creators).
- **Problem** — 3 stat cards (57% / 5–15 / 17%).
- **Agent Demo** — simulated "Indyfren · Chat" window that auto-streams responses across tabs (Find deals / Draft pitch / Review contract), cycling every 9s with a typing caret.
- **How it works** — dark gradient section, 3 numbered steps with connectors.
- **Skills grid** — "12 specialized skills"; 12 cards, color-rotated backgrounds.
- **Social proof** — $37B / 3× stat cards + a testimonial card (@creator, 280K followers).
- **Pricing** — Free ($0, "Active now", 5 feature checks) + Pro ("Coming soon", dimmed).
- **FAQ** — 5 accordion items (differentiation vs ChatGPT, send vs draft, wallet/payment, platforms, privacy).
- **Footer CTA** — dark gradient, "Get started free →".
- **Footer** — logo, tagline, links, copyright.

### 9.2 Dashboard "Today" (`/dashboard`)

Two-zone layout under the hero:

- **Home Hero** (gradient card) — dynamic title + summary, optional **urgent items** list (e.g. "Approval needed", "Responded", "Negotiating" badges linking to specific deals), **stat cards** (urgent ones flip to pink), primary + secondary CTA.
- **Command Bar** — search-style control "Search or ask Indyfren anything…" with ⌘K chip; clicking focuses the agent console input.
- **Workspace** (2-col on lg) — **Agent Console** (chat, left) + **Support Rail** (right: pending actions → opportunities → recent activity → connected channels). Pending approvals render in the dark gradient style.
- **At a glance** — 3 insight stat cards.

### 9.3 Deals (`/dashboard/deals`)

- Header surface: total deals + pipeline value + Refresh. Auto-refreshes every 10s and on tab focus / broadcast events.
- Pending agent-actions banner (dark gradient) when approvals exist.
- **8-column horizontal-scroll kanban**, each column = stage with colored dot, label, count badge, and deal cards. Empty "Discovered" column nudges "Ask Indyfren to scan →".

### 9.4 Wallet (`/dashboard/wallet`)

- "Sandbox / testnet wallet" surface + copy-address.
- Funding notice (info or low-balance warning).
- Balance card (green), wallet address card (mono, copyable), spend explainer + total-spent card (blue).
- Transaction history list with status badges (settled/pending/failed), service, amount (+credit green / −debit pink), error text, date. Empty + loading states.

### 9.5 Reports (`/dashboard/reports`)

- Intro surface.
- **Revenue** card: period heading + 6 stats (income, expenses, net, active deals, pipeline value, monthly forecast w/ confidence). Shimmer loading; empty → "Scan for brand deals".
- **Audience** card: total followers + per-platform rows (follower count, engagement %, or "Sync error — reconnect"). Empty → "Connect a platform".

### 9.6 Settings (`/dashboard/settings`)

- Intro surface (+ OAuth success/error messages).
- **Connected platforms** (PlatformConnect component) — manage OAuth + manual connections; gated to `wallet_pending`/`active`.
- **Spending controls** — 3 limit inputs (per-transaction / daily / monthly) + Save.
- **Profile settings** form.
- **Chat channels** — Telegram + WhatsApp connect/refresh with generated command + launch link + expiry; plus a "One agent, every channel" explainer.
- **Account summary** (dark gradient) — name, status, connected platforms count, chat channels.
- Optional debug access-token panel (dev only).

### 9.7 Bot message templates (Telegram / WhatsApp)

Markdown messages with bold, emoji, and inline buttons. Key templates: welcome/onboarding questions, scan results (brand + fit/100 + est. value + reason), rate card, contract review (🟢🟡🔴 risk + issues + missing clauses), financial snapshot, revenue report (📈📉➡️ trends), content strategy, wallet balance, morning brief, approval prompt (✅ Send / ❌ Skip), feedback (👍 / 👎 Not quite). **These deserve real design** — they're the daily surface but currently raw Markdown.

---

## 10. Current Design System (extracted from `globals.css`)

The dashboard runs on CSS variables. The redesign can replace these wholesale, but here's the current token set so nothing gets lost and parity is intentional.

### Color

| Token                                 | Value                 | Use                                                  |
| ------------------------------------- | --------------------- | ---------------------------------------------------- |
| `--bg-canvas`                         | `#F6F6F8`             | App background                                       |
| `--bg-surface`                        | `#EFEFEF`             | Cards/panels                                         |
| `--bg-input`                          | `#F5F5F5`             | Inputs, subtle fills                                 |
| `--border-default`                    | `#EBEBEB`             | Hairline borders                                     |
| `--border-light`                      | `#E0E0E0`             | Input borders                                        |
| `--border-focus`                      | `#2D7CF6`             | Focus ring                                           |
| `--text-primary`                      | `#000000`             | Headlines/body                                       |
| `--text-secondary`                    | `#555555`             | Secondary                                            |
| `--text-tertiary`                     | `#8E8E93`             | Muted labels                                         |
| `--text-placeholder` / `--text-muted` | `#AEAEB2` / `#C7C7CC` | Placeholders, timestamps                             |
| `--accent-pink`                       | `#FF2D78`             | Primary brand accent / nav active / discovered stage |
| `--accent-blue`                       | `#2D7CF6`             | Primary action buttons, links                        |
| `--accent-green`                      | `#34C759`             | Success, approve, balance                            |
| Purple (inline)                       | `#8b5cf6`             | Tertiary accent on marketing                         |
| Stage ambers                          | `#e6a817`, `#e65100`  | Responded / Negotiating                              |

Each accent has `-bg`, `-border`, `-border-strong` translucent variants for tinted cards.

### Gradients

- `--gradient-hero`: subtle pink→blue (5% opacity) — dashboard hero
- `--gradient-logo`: `#FF2D78 → #FF6B9D` — logo mark
- `--gradient-avatar`: `#2D7CF6 → #6BA3FF` — profile avatar
- `--gradient-approval`: `#1a1a2e → #16213e` — **the "dark ink" treatment used for every approval/trust surface** (approval banners, account summary, how-it-works, footer CTA). This dark gradient is effectively a second brand mode signaling "agent action / decision moment."

### Typography

- Family: `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif` (system stack — **no custom typeface today**; a real type system is an open opportunity).
- Weights in use: 500/600/700/800. Headlines 800, tight letter-spacing. Marketing headline up to 68px; dashboard headings ~24px; body 13–15px; labels 10–12px uppercase.

### Spacing / layout tokens

`--space-page: 32px`, `--space-section: 24px`, `--space-card-padding: 20px`, `--column-gap: 24px`, `--nav-height: 56px`, dashboard max width `1200px`, marketing max width `1280px` (`max-w-7xl`).

### Radii

`--radius-hero: 16px`, `--radius-card: 14px`, `--radius-input: 12px`, `--radius-button: 10px`, `--radius-chip: 8px`, `--radius-badge: 6px`. (Pills use `99/999`.)

### Motion

Shimmer keyframe for skeletons; `pulse` for live dots and streaming caret; fade transitions on cycling cards; 0.12–0.4s ease micro-transitions. Tailwind CSS + (intended) Framer Motion.

> **Observation for redesign:** styling is currently a mix of CSS variables, Tailwind utility classes, and a large amount of **inline `style={}}` objects** in components. A redesign is a good moment to consolidate into a real, tokenized component library. The dark "approval gradient" should be deliberately re-considered as a system, not an accident.

---

## 11. Component Inventory (reusable pieces today)

`top-nav`, `command-bar`, `agent-console`, `dashboard-home-hero`, `dashboard-support-rail`, `onboarding-wizard`, `deal-card` (+ inline kanban card), `wallet-balance`, `platform-connect`, `profile-settings-form`, `morning-brief`, `dashboard-auth-gate` (state cards), `tooltip`, `icons` (custom SVG set: Clock, Card, Document, BarChart, Gear, List, Search, Check, ChevronRight, Grid, Pulse), and a shared `ui` kit (`Button` [primary/secondary/ghost, sm], `Surface`, `Notice` [info/warning/danger], `StatusBadge` [info/neutral/success/warning/danger], `EmptyState`).

Reusable patterns worth systematizing in the redesign: **Surface** (eyebrow + title + detail header block), **Notice** (inline status banner), **StatusBadge**, **EmptyState** (title + detail + optional action), **stat card**, **approval card**, **deal/kanban card**, **chip-select**, **state card**.

---

## 12. States & Edge Cases (must be designed, not just happy-path)

Every data surface has these states today — keep them in the redesign:

- **Loading** — shimmer skeletons (reports), "Loading your conversation…" (console), "—" placeholders.
- **Empty** — first-run with no deals/transactions/platforms; each empty state has a _specific_ nudge CTA (scan, connect, ask Indyfren).
- **Error** — inline `Notice`/banner with the actual API error string; deal-move failures shown on the card; balance fetch failure.
- **Pending/optimistic** — optimistic user chat bubbles (rolled back on failure); "Indyfren is working…" status; deal auto-refresh every 10s; cross-tab sync via BroadcastChannel.
- **Wallet pending** — usable app with a persistent "setting up your wallet" banner; paid actions gated.
- **Transaction statuses** — settled / pending / **failed** (failed paid calls are intentionally surfaced, not hidden).
- **Low balance** — <$5 warning before approving paid actions.
- **OAuth** — success / `provider_access_denied` / generic error returned to settings.
- **Platform sync error** — "Sync error — reconnect in Settings" per platform row.
- **Channel already in use / expired link** — bot linking failure messages.

---

## 13. Known Problems & Redesign Goals

Things the current build does _functionally_ but not _beautifully_ — prime targets:

1. **Two visual identities.** Bold consumer marketing vs. flat utilitarian dashboard. Decide one coherent system that scales from hero to data table.
2. **No real type system.** System font only. A distinctive typeface + scale would do a lot of brand work.
3. **The "agent is working" experience is thin.** The magic is an autonomous agent — but in-product it's mostly text bubbles + a status line. Reasoning, progress, which-skill-is-active, and action provenance deserve richer, trust-building visualization.
4. **Approvals are scattered** across three components with three slightly different card treatments. Unify into one canonical "decision card" pattern across web + bot.
5. **Bot templates are raw Markdown.** The actual daily driver. Needs designed message systems (rich cards, button layouts, consistent iconography) within Telegram/WhatsApp constraints.
6. **Trust surfaces under-designed.** Spending limits, audit trail, kill switch, "why did you do this?", data isolation — architecture promises a strong trust model; the UI barely expresses it. This is a competitive moat; design it like one.
7. **First-run reveal could be a showpiece.** The onboarding step-4 scan is the conversion moment; today it's a text box. Make it feel earned.
8. **Pipeline kanban with 8 horizontally-scrolling columns** is cramped, especially mobile. Rethink pipeline visualization (board vs. list vs. priority queue).
9. **Mobile.** Dashboard is responsive-ish but clearly desktop-first, while the product philosophy ("meet creators where they are") is mobile/chat-first. Resolve this contradiction.
10. **Tiering is coming.** Only Free exists in UI; Pro is "coming soon." Design must accommodate paywalls, upgrade moments, and plan comparison.

---

## 14. Constraints & Technical Realities (so designs are buildable)

- **Stack:** Next.js 15 (App Router) + Tailwind CSS; dashboard targets desktop + mobile web. Backend is a Hono API; auth via **Privy** (social login, embedded wallets).
- **Auth gating is real** — designs for `/dashboard/*` must account for all six auth stages (§6), not just `active`.
- **Wallet is on Tempo Network (testnet/sandbox today)**, USDC, x402 micropayments. Wallet UI must speak "creator-friendly money", not "crypto" — current copy deliberately avoids seed phrases and frames it as a simple top-up. Keep that.
- **Real-time-ish sync** via polling (10s) + BroadcastChannel + session-storage stale-while-revalidate caching. Designs should assume content can update live and show fresh-vs-cached gracefully.
- **Markdown is the lingua franca** of agent output across surfaces (bold, lists, emoji). Components rendering agent text need to handle markdown-lite.
- **Cross-surface parity** — anything shown in the dashboard (deals, approvals, wallet, chat) can also appear in Telegram/WhatsApp. Patterns should translate to a text+button medium.
- **Platform reality:** YouTube OAuth is live; other platform connects are manual/partial. Don't over-promise connected-platform richness in flows that aren't wired yet (mark as future where relevant).

---

## 15. What We'd Like From the Design Team

1. **A unified design system / DESIGN.md** — color, a real typographic system, spacing, radii, motion, elevation, and a tokenized component library that covers both marketing and product.
2. **Redesigned core flows** (priority order): first-run onboarding + scan reveal → daily agent console → deal pipeline + approvals → wallet/spend & trust → reports → settings.
3. **An "agent at work" visual language** — how the product shows reasoning, progress, skill activity, action provenance, and the approve/skip decision moment, consistently across web and chat.
4. **Marketing site redesign** that carries the new system and the "works your deals" positioning.
5. **Bot message design system** for Telegram/WhatsApp (cards, buttons, iconography within platform limits).
6. **Mobile-first reconciliation** — resolve the desktop-dashboard vs. mobile-chat tension.
7. **Trust & control surfaces** designed as a feature, not fine print (spending limits, audit trail, pause/kill switch, transparency).
8. **States** — loading/empty/error/pending/low-balance/wallet-pending for every surface.
9. **Tiering-ready** patterns (paywalls, upgrade prompts, plan comparison) for the imminent Pro tier.

---

## Appendix — Source Map (where this came from)

- Product/architecture: `architecture.md`, `README.md`, `product-spec-skills.jsx`, `agent-skills-spec.jsx`, `user-flows.jsx`, `creator-economy-research.jsx`, `docs/COMPLETION_STATUS.md`
- Marketing: `dashboard/src/app/page.tsx`
- Dashboard shell/nav: `dashboard/src/app/dashboard/layout.tsx`, `components/top-nav.tsx`, `components/command-bar.tsx`
- Today: `dashboard/src/app/dashboard/page.tsx`, `components/dashboard-home-hero.tsx`, `components/agent-console.tsx`, `components/dashboard-support-rail.tsx`, `lib/dashboard-home.ts`
- Deals: `dashboard/src/app/dashboard/deals/page.tsx`, `lib/api.ts` (`DEAL_STAGE_ORDER`)
- Wallet: `dashboard/src/app/dashboard/wallet/page.tsx`
- Reports: `dashboard/src/app/dashboard/reports/page.tsx`
- Settings: `dashboard/src/app/dashboard/settings/page.tsx`, `components/platform-connect.tsx`
- Auth/onboarding: `lib/auth-state.ts`, `lib/privy.tsx`, `components/dashboard-auth-gate.tsx`, `components/onboarding-wizard.tsx`, `lib/consumer-copy.ts`
- Design tokens: `dashboard/src/app/globals.css`
- Agent skills/routing: `src/agent/os/router.ts`, `src/agent/skills/*`
- Bot surfaces: `src/bot/handler.ts`, `src/bot/formatters.ts`
  </content>
  </invoke>
