# Dashboard UI Redesign — Vibrant Creator Minimalism

**Date:** 2026-03-22
**Branch:** codex-dashboard-consumer-revamp
**Status:** Approved

## Summary

Redesign the Indyfren dashboard from its current warm editorial aesthetic (paper/parchment, serif fonts, uppercase eyebrows, rounded-28px cards with shadows) to a **Vibrant Creator Minimalism** design that resonates with creators, artists, and creative people. The design is minimal in structure but vibrant through accent colors woven throughout.

## Design Decisions

| Decision | Choice |
|----------|--------|
| Design direction | Vibrant Creator Minimalism — white canvas + system font, accent colors threaded everywhere |
| Navigation | Top nav, full width — logo + icon-tabs across the top, content fills below |
| Accent colors | Hot pink `#FF2D78` (brand, active states), blue `#2D7CF6` (action CTAs), green `#34C759` (success/connected) |
| Icon system | Minimal 14px SVG stroke icons (1.5px weight) on all buttons, tabs, and section headers with tooltip on hover |
| Spacing | 8px base grid with consistent 24px section gaps, 32px page padding, 20px card padding |

## Design Tokens

### Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-canvas` | `#FFFFFF` | Page background |
| `--bg-surface` | `#FAFAFA` | Chat workspace, card interiors |
| `--bg-input` | `#F5F5F5` | Input fields, command bar, icon button backgrounds |
| `--border-default` | `#EBEBEB` | Dividers, card borders, section separators |
| `--border-light` | `#E0E0E0` | Input borders |
| `--border-focus` | `#2D7CF6` | Input focus/hover border |
| `--text-primary` | `#000000` | Headings, body text |
| `--text-secondary` | `#555555` | Inactive nav tabs |
| `--text-tertiary` | `#8E8E93` | Captions, timestamps, labels |
| `--text-placeholder` | `#AEAEB2` | Input placeholders |
| `--text-muted` | `#C7C7CC` | Disabled text |
| `--accent-pink` | `#FF2D78` | Brand logo, active tab, pink quick prompts, deal alerts |
| `--accent-pink-bg` | `rgba(255,45,120,0.08)` | Active tab background, pink tint surfaces |
| `--accent-pink-subtle` | `rgba(255,45,120,0.04)` | Insight card backgrounds |
| `--accent-pink-border` | `rgba(255,45,120,0.1)` | Insight card borders |
| `--accent-pink-border-strong` | `rgba(255,45,120,0.2)` | Quick prompt chip borders |
| `--accent-blue` | `#2D7CF6` | Primary CTAs, deal values, "View all" links |
| `--accent-blue-hover` | `#1B6AE0` | Primary CTA hover |
| `--accent-blue-bg` | `rgba(45,124,246,0.04)` | Featured opportunity cards, blue insight cards |
| `--accent-blue-border` | `rgba(45,124,246,0.1)` | Blue tinted borders |
| `--accent-blue-border-strong` | `rgba(45,124,246,0.2)` | Quick prompt chip borders |
| `--accent-green` | `#34C759` | Online indicator, approve button |
| `--accent-green-hover` | `#2DB84E` | Approve button hover |
| `--accent-green-bg` | `rgba(52,199,89,0.1)` | Success activity icons, green insight cards, connected channels |
| `--accent-green-text` | `#2E7D32` | Connected channel label text |
| `--bg-disconnected` | `#F5F5F5` | Disconnected channel tag background |
| `--gradient-hero` | `linear-gradient(135deg, rgba(255,45,120,0.05), rgba(45,124,246,0.05))` | Hero section background |
| `--gradient-logo` | `linear-gradient(135deg, #FF2D78, #FF6B9D)` | Logo icon mark |
| `--gradient-avatar` | `linear-gradient(135deg, #2D7CF6, #6BA3FF)` | User avatar, send button |
| `--gradient-approval` | `linear-gradient(135deg, #1a1a2e, #16213e)` | Approval card dark background |

### Typography

| Token | Size | Weight | Extra | Usage |
|-------|------|--------|-------|-------|
| `--font-family` | — | — | `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif` | All text |
| `heading-xl` | `28px` | `700` | `-0.4px tracking, 1.15 line-height` | Hero greeting |
| `heading-section` | `13px` | `600` | — | Section labels (Workspace, At a glance, Opportunities, Recent activity, Connected channels) |
| `body` | `13px` | `400` | `1.55 line-height` | Chat messages, descriptions |
| `body-medium` | `13px` | `500` | — | Opportunity card titles, activity row titles, nav tab inactive |
| `body-large` | `14px` | `400` | `1.5 line-height` | Hero summary line, chat header |
| `caption` | `12px` | `400` | — | Timestamps, sub-labels ("Review stage", "3h ago"), insight card labels |
| `caption-bold` | `12px` | `500-600` | — | Insight detail lines, "View all" links, channel tags |
| `micro` | `11px` | `500` | — | Tooltips, thread badge, approval "APPROVAL NEEDED" label, timestamp on messages |
| `tab-active` | `13px` | `600` | — | Active nav tab |
| `tab-inactive` | `13px` | `500` | — | Inactive nav tab |
| `cta` | `13px` | `600` | — | Button text |
| `logo` | `15px` | `700` | `-0.3px tracking` | Logo wordmark |
| `stat-large` | `26px` | `700` | `-0.3px tracking` | Insight card numbers |
| `stat-value` | `14px` | `700` | — | Opportunity deal values |

All text uses **sentence case**. Only exception: "APPROVAL NEEDED" inside the dark approval card.

### Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `--space-page` | `32px` | Page content padding (all sides) |
| `--space-section` | `24px` | Gap between major sections |
| `--space-card-padding` | `20px` | Internal padding of chat workspace, insight cards |
| `--space-hero-padding` | `24px` | Hero section internal padding |
| `--space-item-gap-sm` | `8px` | Gap between chips, buttons, channel tags |
| `--space-item-gap-md` | `12px` | Gap within activity rows (icon to text), section header to content |
| `--space-divider-above` | `16px` | Space above section label before divider |
| `--space-divider-below` | `20px` | Space below divider before content |
| `--nav-height` | `56px` | Top navigation bar height |
| `--command-bar-height` | `46px` | Command/search bar height |
| `--column-gap` | `24px` | Gap between chat and support rail columns |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-hero` | `16px` | Hero section |
| `--radius-card` | `14px` | Chat workspace, insight cards |
| `--radius-input` | `12px` | Inputs, command bar, messages, approval cards |
| `--radius-button` | `10px` | CTAs, opportunity cards |
| `--radius-chip` | `8px` | Quick prompts, channel tags, nav tabs, icon buttons, activity icons |
| `--radius-badge` | `6px` | Tooltips, ⌘K badge, thread badge |
| `--radius-circle` | `50%` | Avatar, online indicator, send button |
| `--radius-logo` | `8px` | Logo icon mark |

### Transitions

All interactive elements use `transition: all 0.15s ease`. Specific overrides:

| Element | Duration | Property |
|---------|----------|----------|
| Nav tabs | `0.15s` | `background, color` |
| Buttons | `0.15s` | `background, transform` |
| Tooltips | `0.15s` | `opacity, transform` |
| Cards/rows | `0.15s` | `transform, box-shadow, background` |
| Input borders | `0.15s` | `border-color` |

## Layout Architecture

### File: `dashboard/src/app/dashboard/layout.tsx`

**Current**: 280px left sidebar (`md:grid-cols-[280px_minmax(0,1fr)]`) with logo, nav links, workspace status panel, sign out button. Uses `.surface-card`, `.eyebrow`, `.display-title`, `.cta-primary`, `.cta-secondary` classes.

**New**: Replace the entire sidebar grid with a top nav bar + single-column content area.

```
┌─────────────────────────────────────────────────────┐
│ [i] indyfren   Today Deals Wallet Reports Settings  │ 56px nav
│                                          🔔 🔍 (B)  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  {children} — full-width, 32px padding              │
│                                                     │
└─────────────────────────────────────────────────────┘
```

- The sidebar `<aside>` is removed entirely
- The grid `md:grid-cols-[280px_minmax(0,1fr)]` becomes a single column
- Auth state (login/logout) moves into the avatar dropdown (future) — for now, keep the sign-out button in Settings
- Workspace status info is removed from the nav (it's now in the hero summary line)

### Top Navigation (56px)
- Logo: gradient icon mark (28px square, 8px radius) + wordmark
- Tabs: Today, Deals, Wallet, Reports, Settings — each with a 14px stroke icon + label
- Active tab: pink text + `--accent-pink-bg` background pill
- Inactive tabs: `--text-secondary` text, background becomes `--bg-input` on hover
- Right side: notification icon button, search icon button, avatar — all with tooltips on hover
- Auth: if `stage === "signed_out"`, show "Sign in" button in place of avatar

### Hero Section
- Sits on `--gradient-hero` background
- Greeting: "Good morning, {name}" — uses `heading-xl` style. Time-aware: "Good morning" before 12pm, "Good afternoon" 12-5pm, "Good evening" after 5pm
- Summary line (`body-large`, `--text-secondary`): "{N} approval(s)" in `--accent-pink` + "waiting" · "{N} follow-up(s)" in `--accent-blue` + "in motion" · "wallet ready" (or "wallet setting up" if provisioning)
- If no approvals: omit that segment. If no follow-ups: omit that segment. If nothing pending: "All clear — you're up to date"
- Primary CTA: `--accent-blue` filled, checkmark icon + "Review approvals" (links to first pending approval in chat). Hidden if no approvals.
- Secondary CTA: outlined `--border-light`, clock icon + "See opportunities" (links to /dashboard/deals)
- 24px internal padding, 16px radius

### Command Bar
- Full-width, `--bg-input` background, 46px height, 12px radius
- Search icon (14px, `--text-placeholder` stroke) + placeholder "Search or ask Indyfren anything..." + `--accent-pink-bg` badge with `--accent-pink` text "⌘K"
- On hover: 1.5px `--border-default` border appears
- On click: focuses the agent console input below (scrolls to it). Command bar is a shortcut, not a separate search modal.

### Workspace Section
- Section label "Workspace" (`heading-section`) left-aligned, no right action link
- 1px `--border-default` divider, `--space-divider-below` gap below
- Two equal-width columns (`flex:1` each) with `--column-gap` gap

#### Chat Column (left)
- `--bg-surface` background, `--radius-card` radius, 1px `--border-default` border, `--space-card-padding` padding
- Header: 8px green `--accent-green` dot + "Chat with Indyfren" (`body-large`, 600 weight) + thread icon button (28px, `--border-default` bg, tooltip: "View thread history")
- Quick prompt chips in a flex row with `--space-item-gap-sm` gap:
  - "Plan my day" — pink (clock icon)
  - "Check deals" — blue (card icon)
  - "Wallet activity" — blue (document icon)
  - "Draft reply" — pink (paper plane icon)
- Messages: `#FFFFFF` background, `--radius-input` radius, 1px `--border-default` border, 14px padding. Text at `body` size. Timestamp at `micro` size, `--text-placeholder` color.
- User messages and assistant messages both use white background (no distinction needed — the content makes it clear)
- Approval cards: `--gradient-approval` background, `--radius-input` radius, 14px padding. "APPROVAL NEEDED" at `micro` size, `rgba(255,255,255,0.45)`. Description at `body` size, white. Approve button: `--accent-green` bg, white text, checkmark icon. Skip button: `rgba(255,255,255,0.1)` bg, `rgba(255,255,255,0.7)` text, X icon. Multiple approvals stack vertically with 12px gap.
- Input: white background, 1.5px `--border-light` border (becomes `--border-focus` on hover/focus), `--radius-input` radius. Placeholder at `body` size, `--text-muted`. Send button: 30px circle, `--gradient-avatar` background, up-arrow icon white, tooltip: "Send message".

#### Support Rail (right)
Three sections separated by 1px `--border-default` dividers with `--space-section` gap above and below each divider:

1. **Opportunities** — card icon + "Opportunities" (`heading-section`) left, "View all →" (`caption-bold`, `--accent-blue`) right. Cards: `--radius-button` radius, 12px 14px padding. First card (highest value or most urgent): `--accent-blue-bg` background + `--accent-blue-border` border, value in `stat-value` + `--accent-blue`. Other cards: `--border-default` border only. Hover: translateY(-1px) + tint intensifies.
2. **Recent activity** — pulse icon + "Recent activity" (`heading-section`) left, "View all →" right. Rows: 32px icon container (`--radius-chip`, colored bg matching type) + 12px gap + text + chevron-right icon (`--text-placeholder`). Payment received: green checkmark on `--accent-green-bg`. Platform connected: pink refresh on `--accent-pink-bg`. Row hover: subtle background + expand padding.
3. **Connected channels** — grid icon + "Connected channels" (`heading-section`) left, "Manage →" right. Tag chips (`--radius-chip`, 6px 14px padding): connected platforms use `--accent-green-bg` + `--accent-green-text`. Disconnected platforms use `--bg-disconnected` + `--text-tertiary` with "+" prefix (e.g., "+ TikTok"). Hover: scale(1.04).

### At a Glance Section
- Bar chart icon + "At a glance" (`heading-section`) label + divider (mirrors Workspace pattern)
- Three equal-width insight cards with 16px gap
- Each card: `--radius-card` radius, `--space-card-padding` padding
  - **Total earned**: `--accent-green-bg` bg, `rgba(52,199,89,0.1)` border, trend-up icon in `--accent-green`, label "Total earned" (`caption`, `--text-tertiary`), value (`stat-large`), detail "+X% this month" (`caption-bold`, `--accent-green`)
  - **Active deals**: `--accent-pink-subtle` bg, `--accent-pink-border` border, card icon in `--accent-pink`, label "Active deals", value, detail "N needs review" (`caption-bold`, `--accent-pink`)
  - **Wallet balance**: `--accent-blue-bg` bg, `--accent-blue-border` border, document icon in `--accent-blue`, label "Wallet balance", value, detail "USDC on Base" (`caption-bold`, `--accent-blue`)
- Hover: translateY(-2px) + `box-shadow: 0 4px 12px rgba(0,0,0,0.06)`

## Icon System

All icons are React components rendering inline `<svg>` elements. Create a single `icon.tsx` file that exports named icon components.

**Props interface:**
```tsx
interface IconProps {
  size?: number;      // default 14
  className?: string; // for color via text-* classes
  strokeWidth?: number; // default 1.5
}
```

**Common SVG attributes on all icons:**
```
viewBox="0 0 16 16" fill="none" stroke="currentColor"
strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
```

Color is inherited from the parent via `currentColor` unless overridden with `className`.

### Icon Catalog

| Export name | Path data (d) | Usage |
|-------------|--------------|-------|
| `IconClock` | `<circle cx="8" cy="8" r="6.5"/><path d="M8 4.5v3.5l2.5 1.5"/>` | Today tab, opportunities CTA, "Plan my day" |
| `IconCard` | `<rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M2 6.5h12"/>` | Deals tab, Opportunities header, "Check deals", deals insight |
| `IconDocument` | `<rect x="3" y="2.5" width="10" height="11" rx="1.5"/><path d="M6 6h4M6 8.5h4M6 11h2"/>` | Wallet tab, "Wallet activity", wallet insight |
| `IconBarChart` | `<path d="M4 12.5V7M8 12.5V3.5M12 12.5V5.5"/>` | Reports tab, "At a glance" header |
| `IconGear` | `<circle cx="8" cy="8" r="2.5"/><path d="M13.5 8a5.5 5.5 0 01-.4 2l.9 1.5-1.5.9-1.2-.7a5.5 5.5 0 01-1.8.8L9 14H7l-.5-1.5a5.5 5.5 0 01-1.8-.8l-1.2.7-1.5-.9.9-1.5A5.5 5.5 0 012.5 8c0-.7.1-1.4.4-2L2 4.5 3.5 3.6l1.2.7a5.5 5.5 0 011.8-.8L7 2h2l.5 1.5a5.5 5.5 0 011.8.8l1.2-.7 1.5.9-.9 1.5c.3.6.4 1.3.4 2z"/>` | Settings tab |
| `IconCheck` | `<path d="M2.5 8.5l4 4L13.5 3.5"/>` | Review approvals CTA, Approve button, payment received |
| `IconX` | `<path d="M4 4l8 8M12 4l-8 8"/>` | Skip button |
| `IconSend` | `<path d="M14 2L7 9M14 2l-4 12-3-5-5-3z"/>` | "Draft reply" prompt |
| `IconBell` | `<path d="M4 6a4 4 0 018 0c0 4 2 5 2 5H2s2-1 2-5"/><path d="M6.5 13a1.5 1.5 0 003 0"/>` | Notifications |
| `IconSearch` | `<circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/>` | Search button, command bar |
| `IconList` | `<path d="M3 4h10M3 8h6M3 12h8"/>` | Thread button |
| `IconArrowUp` | `<path d="M8 12V4M5 7l3-3 3 3"/>` | Send button |
| `IconPulse` | `<path d="M2 8h3l2-5 2 10 2-5h3"/>` | Activity header |
| `IconGrid` | `<path d="M6 2v12M10 2v12M2 6h12M2 10h12"/>` | Channels header |
| `IconRefresh` | `<path d="M13 3v4h-4"/><path d="M3 8a5 5 0 019-2l1 1"/><path d="M3 13V9h4"/><path d="M13 8a5 5 0 01-9 2l-1-1"/>` | Platform connected activity |
| `IconChevronRight` | `<path d="M6 4l4 4-4 4"/>` | Activity row arrow |
| `IconTrendUp` | `<path d="M8 1v14M4.5 4L8 1l3.5 3"/>` | Total earned insight |

### Tooltip Component

`tooltip.tsx` — a wrapper component:

```tsx
interface TooltipProps {
  label: string;
  children: React.ReactNode;
}
```

Renders a `position: relative` wrapper. On hover, shows an absolutely-positioned tooltip above with:
- Background: `#1a1a2e`, color: `#fff`, font: 11px/500, padding: 5px 10px, border-radius: 6px
- 4px CSS triangle (border trick) pointing down, same background color
- Animation: opacity 0→1 + translateY(4px→0) over 0.15s ease
- Centered horizontally above the trigger element, 8px gap

## Loading, Error & Empty States

### Loading
- Chat workspace: three pulsing dots animation centered in the message area
- Support rail sections: two 12px-height shimmer bars per section (matching item width)
- Insight cards: number placeholder as a 60px shimmer bar, label as 40px shimmer bar
- All shimmers use `--bg-input` → `--border-default` → `--bg-input` animation, 1.5s ease infinite

### Error
- Chat: existing behavior preserved — show last known messages + error banner with "Refresh" button
- Support rail: section shows "Couldn't load" (`caption`, `--text-tertiary`) + "Retry" link (`--accent-blue`)
- Insight cards: show "—" as value, label remains, no detail line

### Empty States
- No messages (first-time): show quick prompts prominently + "Start a conversation with Indyfren" helper text (`body`, `--text-tertiary`)
- No opportunities: "No deals yet" + "See opportunities" link to /dashboard/deals
- No activity: "No recent activity"
- No channels: "Connect a channel to get started" + "Manage →" link triggers platform connect
- All empty text uses `caption` size, `--text-tertiary` color, centered in the section

## Responsive Behavior

Current responsive classes are maintained with adjustments for the new layout:

| Breakpoint | Behavior |
|------------|----------|
| `< 768px` (mobile) | Nav tabs collapse to icon-only (no labels). Two-column workspace stacks to single column (chat on top, rail below). Insight cards stack 1-column. Page padding reduces to 16px. |
| `768px - 1024px` (tablet) | Full nav with labels. Two-column workspace maintained. Insight cards in 3-column grid. Page padding 24px. |
| `> 1024px` (desktop) | Full layout as designed. Max-width 1200px centered. Page padding 32px. |

## CSS Migration

### Remove from `globals.css`

| What | Current code |
|------|-------------|
| Old color vars | `--paper`, `--parchment`, `--ink`, `--fog`, `--moss`, `--sand`, `--blush`, `--plum` |
| Background gradient | `html { background: radial-gradient(...) }` |
| Body font | `font-family: "Avenir Next", ...` |
| Selection color | `::selection { background: rgba(115, 75, 56, 0.16) }` |
| `.paper-panel` | Entire class |
| `.surface-card` | Entire class |
| `.surface-muted` | Entire class |
| `.cta-primary` | Entire class |
| `.cta-secondary` | Entire class |
| `.eyebrow` | Entire class |
| `.display-title` | Entire class |
| `.soft-grid` | Entire class |

### Add to `globals.css`

All new `--` custom properties from the Design Tokens section above, plus:

```css
html { background: var(--bg-canvas); }
body { font-family: var(--font-family); color: var(--text-primary); }
::selection { background: rgba(45, 124, 246, 0.16); }
```

### Tailwind config

Extend `tailwind.config.ts` colors to reference the new CSS variables so components can use `bg-canvas`, `text-accent-pink`, `border-default`, etc.

## Pages Affected

### `dashboard/src/app/globals.css`
- Full replacement: remove old tokens/classes, add new ones (see CSS Migration section)

### `dashboard/src/app/dashboard/layout.tsx`
- Remove the 280px sidebar grid layout
- Replace with: top nav bar (56px) + single-column content
- Move auth login/logout into nav (avatar area) or keep sign-out in Settings page
- Remove dependencies on `.surface-card`, `.eyebrow`, `.display-title`, `.cta-primary`, `.cta-secondary`
- Remove `consumer-copy` shell/status imports (status info moves to hero summary)

### `dashboard/src/app/dashboard/page.tsx` (Today / home)
- Hero section with gradient background
- Command bar
- Two-column workspace (chat + support rail)
- "At a glance" insight cards

### `dashboard/src/app/dashboard/deals/page.tsx`
- Apply new typography (sentence case, system font)
- Apply new color tokens
- Add icons to section headers and buttons

### `dashboard/src/app/dashboard/wallet/page.tsx`
- Apply new tokens, remove old card styles
- Add icons to CTAs and section headers

### `dashboard/src/app/dashboard/reports/page.tsx`
- Apply new tokens and typography
- Add icons

### `dashboard/src/app/dashboard/settings/page.tsx`
- Apply new tokens, typography, spacing
- Add icons to section headers
- Add sign-out button here (moved from sidebar)

### Existing Components to Update
- `agent-console.tsx` — Match chat workspace design: white message backgrounds with 12px radius, quick prompt icons, tooltip on send, input hover blue border, approval card with gradient
- `dashboard-home-hero.tsx` — Rewrite with gradient background, time-aware greeting, colored summary keywords, icon CTAs
- `dashboard-support-rail.tsx` — Add section icons, dividers between sections, hover states, "View all →" links, chevron arrows on activity rows
- `dashboard-auth-gate.tsx` — Update to new typography and colors (remove serif, uppercase)
- `platform-connect.tsx` — New token colors
- `profile-settings-form.tsx` — New tokens
- `deal-card.tsx` — Remove shadows, use tinted borders
- `wallet-balance.tsx` — New tokens
- `morning-brief.tsx` — New tokens

### New Components
- `top-nav.tsx` — Top navigation bar with icon tabs, tooltips, notification/search/avatar buttons
- `tooltip.tsx` — Reusable tooltip wrapper (see Tooltip Component section)
- `icon.tsx` — SVG icon components (see Icon Catalog section)
- `command-bar.tsx` — Search/ask bar that focuses agent console input on click

## Visual Reference

Mockup files in `.superpowers/brainstorm/23614-1774172077/` (design exploration, not implementation source):
- `direction-compare.html` — Design direction options (selected: Creator Minimalism)
- `navigation-layout.html` — Navigation options (selected: Top nav)
- `full-dashboard-v4.html` — Final approved mockup with icons, tooltips, hover states

## Out of Scope
- Dark mode (follow-up spec)
- Advanced animation/motion system beyond hover transitions
- Onboarding flow redesign
- Avatar dropdown menu (future — for now sign-out stays in Settings)
