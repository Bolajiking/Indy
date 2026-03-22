# Dashboard UI Redesign — Vibrant Creator Minimalism

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Indyfren dashboard from warm editorial aesthetic to Vibrant Creator Minimalism with top nav, icon system, accent colors, and consistent spacing.

**Architecture:** Replace globals.css tokens and utility classes, build new shared components (icons, tooltip, top-nav, command-bar), rewrite layout from sidebar to top-nav, then update each page and component to use the new design system. TDD throughout — each component gets tests before implementation.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS, Vitest, jsdom

**Spec:** `docs/superpowers/specs/2026-03-22-dashboard-ui-redesign-design.md`

**Task dependencies:** Tasks MUST be executed in order. Task 1 (tokens) is required by all others. Tasks 2-5 (new components) are required by Task 6 (layout). Tasks 6+ can only run after 1-5 complete. Tasks 7-13 depend on Task 6.

**Import paths:** This project runs vitest from the root, not from `dashboard/`. All test imports use `../../../dashboard/src/...` paths. This matches the existing test pattern (see `tests/unit/dashboard/agent-console.test.tsx`).

---

## File Structure

### New files to create

| File | Responsibility |
|------|---------------|
| `dashboard/src/components/icons.tsx` | All 17 SVG icon components with shared `IconProps` interface |
| `dashboard/src/components/tooltip.tsx` | Reusable hover tooltip wrapper |
| `dashboard/src/components/top-nav.tsx` | Top navigation bar (replaces sidebar in layout) |
| `dashboard/src/components/command-bar.tsx` | Search/ask command bar that scrolls to agent console |
| `tests/unit/dashboard/icons.test.tsx` | Icon rendering tests |
| `tests/unit/dashboard/tooltip.test.tsx` | Tooltip hover behavior tests |
| `tests/unit/dashboard/top-nav.test.tsx` | Navigation, active tab, auth states |
| `tests/unit/dashboard/command-bar.test.tsx` | Click-to-focus behavior |

### Files to modify

| File | Changes |
|------|---------|
| `dashboard/src/app/globals.css` | Full replacement: old tokens/classes → new design tokens |
| `dashboard/tailwind.config.ts` | Replace color palette with new token references |
| `dashboard/src/app/dashboard/layout.tsx` | Replace sidebar grid → top-nav + single-column |
| `dashboard/src/components/agent-console.tsx` | New message styling, icons on prompts, gradient approval, blue input focus |
| `dashboard/src/components/dashboard-home-hero.tsx` | Gradient bg, time-aware greeting, colored stats, icon CTAs |
| `dashboard/src/components/dashboard-support-rail.tsx` | Section icons, dividers, hover states, "View all" links |
| `dashboard/src/components/dashboard-auth-gate.tsx` | Remove serif/uppercase, use new tokens |
| `dashboard/src/components/deal-card.tsx` | Remove shadows, use tinted borders |
| `dashboard/src/components/wallet-balance.tsx` | New color tokens |
| `dashboard/src/components/morning-brief.tsx` | New color tokens |
| `dashboard/src/components/platform-connect.tsx` | New color tokens |
| `dashboard/src/components/profile-settings-form.tsx` | New color tokens |
| `dashboard/src/app/dashboard/page.tsx` | Command bar, updated section labels + dividers |
| `dashboard/src/app/dashboard/deals/page.tsx` | New tokens, icons, sentence case |
| `dashboard/src/app/dashboard/wallet/page.tsx` | New tokens, icons |
| `dashboard/src/app/dashboard/reports/page.tsx` | New tokens, icons |
| `dashboard/src/app/dashboard/settings/page.tsx` | New tokens, icons, sign-out button |
| `dashboard/src/lib/consumer-copy.ts` | Update copy for new nav (remove shell eyebrow/title) |
| `tests/unit/dashboard/home-state.test.ts` | Update if hero model changes |
| `tests/unit/dashboard/agent-console.test.tsx` | Update class/text assertions |

---

## Task 1: Replace globals.css and Tailwind config

**Files:**
- Modify: `dashboard/src/app/globals.css`
- Modify: `dashboard/tailwind.config.ts`

- [ ] **Step 1: Replace globals.css**

Remove all old CSS variables (`--paper`, `--parchment`, `--ink`, `--fog`, `--moss`, `--sand`, `--blush`, `--plum`), the html background gradient, body font-family, `::selection`, and all utility classes (`.paper-panel`, `.surface-card`, `.surface-muted`, `.cta-primary`, `.cta-secondary`, `.eyebrow`, `.display-title`, `.soft-grid`).

Replace with new design tokens:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg-canvas: #FFFFFF;
  --bg-surface: #FAFAFA;
  --bg-input: #F5F5F5;
  --border-default: #EBEBEB;
  --border-light: #E0E0E0;
  --border-focus: #2D7CF6;
  --text-primary: #000000;
  --text-secondary: #555555;
  --text-tertiary: #8E8E93;
  --text-placeholder: #AEAEB2;
  --text-muted: #C7C7CC;
  --accent-pink: #FF2D78;
  --accent-pink-bg: rgba(255,45,120,0.08);
  --accent-pink-subtle: rgba(255,45,120,0.04);
  --accent-pink-border: rgba(255,45,120,0.1);
  --accent-pink-border-strong: rgba(255,45,120,0.2);
  --accent-blue: #2D7CF6;
  --accent-blue-hover: #1B6AE0;
  --accent-blue-bg: rgba(45,124,246,0.04);
  --accent-blue-border: rgba(45,124,246,0.1);
  --accent-blue-border-strong: rgba(45,124,246,0.2);
  --accent-green: #34C759;
  --accent-green-hover: #2DB84E;
  --accent-green-bg: rgba(52,199,89,0.1);
  --accent-green-text: #2E7D32;
  --bg-disconnected: #F5F5F5;
  --font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
  --space-page: 32px;
  --space-section: 24px;
  --space-card-padding: 20px;
  --space-hero-padding: 24px;
  --space-item-gap-sm: 8px;
  --space-item-gap-md: 12px;
  --space-divider-above: 16px;
  --space-divider-below: 20px;
  --nav-height: 56px;
  --command-bar-height: 46px;
  --column-gap: 24px;
  --radius-hero: 16px;
  --radius-card: 14px;
  --radius-input: 12px;
  --radius-button: 10px;
  --radius-chip: 8px;
  --radius-badge: 6px;
  --radius-logo: 8px;
  --gradient-hero: linear-gradient(135deg, rgba(255,45,120,0.05), rgba(45,124,246,0.05));
  --gradient-logo: linear-gradient(135deg, #FF2D78, #FF6B9D);
  --gradient-avatar: linear-gradient(135deg, #2D7CF6, #6BA3FF);
  --gradient-approval: linear-gradient(135deg, #1a1a2e, #16213e);
}

* { box-sizing: border-box; }

html { background: var(--bg-canvas); }

body {
  margin: 0;
  color: var(--text-primary);
  background: transparent;
  font-family: var(--font-family);
  min-height: 100vh;
}

a { color: inherit; text-decoration: none; }

::selection { background: rgba(45, 124, 246, 0.16); }

/* Shimmer animation for loading states */
@keyframes shimmer {
  0% { background-position: -200px 0; }
  100% { background-position: calc(200px + 100%) 0; }
}

.shimmer {
  background: linear-gradient(90deg, var(--bg-input) 0%, var(--border-default) 50%, var(--bg-input) 100%);
  background-size: 200px 100%;
  animation: shimmer 1.5s ease infinite;
}
```

- [ ] **Step 2: Replace tailwind.config.ts colors**

Replace the old warm color palette with new design token references:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        canvas: "var(--bg-canvas)",
        surface: "var(--bg-surface)",
        input: "var(--bg-input)",
        "border-default": "var(--border-default)",
        "border-light": "var(--border-light)",
        "border-focus": "var(--border-focus)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-tertiary": "var(--text-tertiary)",
        "text-placeholder": "var(--text-placeholder)",
        "text-muted": "var(--text-muted)",
        "accent-pink": "var(--accent-pink)",
        "accent-pink-bg": "var(--accent-pink-bg)",
        "accent-pink-subtle": "var(--accent-pink-subtle)",
        "accent-pink-border": "var(--accent-pink-border)",
        "accent-pink-border-strong": "var(--accent-pink-border-strong)",
        "accent-blue": "var(--accent-blue)",
        "accent-blue-hover": "var(--accent-blue-hover)",
        "accent-blue-bg": "var(--accent-blue-bg)",
        "accent-blue-border": "var(--accent-blue-border)",
        "accent-blue-border-strong": "var(--accent-blue-border-strong)",
        "accent-green": "var(--accent-green)",
        "accent-green-hover": "var(--accent-green-hover)",
        "accent-green-bg": "var(--accent-green-bg)",
        "accent-green-text": "var(--accent-green-text)",
        disconnected: "var(--bg-disconnected)",
      },
      spacing: {
        page: "var(--space-page)",
        section: "var(--space-section)",
      },
      borderRadius: {
        hero: "var(--radius-hero)",
        card: "var(--radius-card)",
        input: "var(--radius-input)",
        button: "var(--radius-button)",
        chip: "var(--radius-chip)",
        badge: "var(--radius-badge)",
        logo: "var(--radius-logo)",
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 3: Verify CSS and Tailwind config parse correctly**

Run: `cd dashboard && npx tailwindcss --help > /dev/null 2>&1 && echo "tailwind ok"`

The full `next build` will fail because existing components still reference removed classes (`paper-panel`, `surface-card`, etc.) — that's fixed in Tasks 6-13. At this stage just confirm the config files have no syntax errors. The dev server (`npm run dev`) should start without CSS parse errors.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/app/globals.css dashboard/tailwind.config.ts
git commit -m "feat: replace design tokens with vibrant creator minimalism palette"
```

---

## Task 2: Icon system

**Files:**
- Create: `dashboard/src/components/icons.tsx`
- Create: `tests/unit/dashboard/icons.test.tsx`

- [ ] **Step 1: Write icon tests**

```tsx
// tests/unit/dashboard/icons.test.tsx
// @vitest-environment jsdom

import React from "react";
import { describe, expect, it } from "vitest";
import { render } from "./test-helpers";
import {
  IconClock, IconCard, IconDocument, IconBarChart, IconGear,
  IconCheck, IconX, IconSend, IconBell, IconSearch,
  IconList, IconArrowUp, IconPulse, IconGrid, IconRefresh,
  IconChevronRight, IconTrendUp,
} from "../../../dashboard/src/components/icons";

// Helper to render and get the SVG element
function renderIcon(Icon: React.FC<any>, props = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const { unmount } = render(<Icon {...props} />, container);
  const svg = container.querySelector("svg");
  return { svg, container, unmount };
}

describe("Icon system", () => {
  it("renders all 17 icons as SVGs", () => {
    const icons = [
      IconClock, IconCard, IconDocument, IconBarChart, IconGear,
      IconCheck, IconX, IconSend, IconBell, IconSearch,
      IconList, IconArrowUp, IconPulse, IconGrid, IconRefresh,
      IconChevronRight, IconTrendUp,
    ];
    for (const Icon of icons) {
      const { svg, container } = renderIcon(Icon);
      expect(svg).toBeTruthy();
      expect(svg?.getAttribute("viewBox")).toBe("0 0 16 16");
      expect(svg?.getAttribute("fill")).toBe("none");
      expect(svg?.getAttribute("stroke")).toBe("currentColor");
      container.remove();
    }
  });

  it("applies default size of 14px", () => {
    const { svg, container } = renderIcon(IconClock);
    expect(svg?.getAttribute("width")).toBe("14");
    expect(svg?.getAttribute("height")).toBe("14");
    container.remove();
  });

  it("accepts custom size", () => {
    const { svg, container } = renderIcon(IconClock, { size: 20 });
    expect(svg?.getAttribute("width")).toBe("20");
    expect(svg?.getAttribute("height")).toBe("20");
    container.remove();
  });

  it("passes className through", () => {
    const { svg, container } = renderIcon(IconClock, { className: "text-accent-pink" });
    expect(svg?.classList.contains("text-accent-pink")).toBe(true);
    container.remove();
  });

  it("applies default stroke-width of 1.5", () => {
    const { svg, container } = renderIcon(IconClock);
    expect(svg?.getAttribute("stroke-width")).toBe("1.5");
    container.remove();
  });
});
```

Note: We need a small test helper since the existing tests use `createRoot` directly. Create `tests/unit/dashboard/test-helpers.tsx`:

```tsx
import React from "react";
import { createRoot } from "../../../dashboard/node_modules/react-dom/client";
import { act } from "../../../dashboard/node_modules/react";

export function render(element: React.ReactElement, container: HTMLElement) {
  const root = createRoot(container);
  act(() => { root.render(element); });
  return {
    unmount: () => { act(() => { root.unmount(); }); },
  };
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/dashboard/icons.test.tsx 2>&1 | tail -10`
Expected: FAIL — module not found

- [ ] **Step 3: Implement icons.tsx**

Create `dashboard/src/components/icons.tsx` with all 17 icon components. Each follows the same pattern:

```tsx
import React from "react";

export interface IconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

function SvgIcon({
  size = 14,
  className,
  strokeWidth = 1.5,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

export function IconClock(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 4.5v3.5l2.5 1.5" />
    </SvgIcon>
  );
}

export function IconCard(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <path d="M2 6.5h12" />
    </SvgIcon>
  );
}

export function IconDocument(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <rect x="3" y="2.5" width="10" height="11" rx="1.5" />
      <path d="M6 6h4M6 8.5h4M6 11h2" />
    </SvgIcon>
  );
}

export function IconBarChart(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M4 12.5V7M8 12.5V3.5M12 12.5V5.5" />
    </SvgIcon>
  );
}

export function IconGear(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <circle cx="8" cy="8" r="2.5" />
      <path d="M13.5 8a5.5 5.5 0 01-.4 2l.9 1.5-1.5.9-1.2-.7a5.5 5.5 0 01-1.8.8L9 14H7l-.5-1.5a5.5 5.5 0 01-1.8-.8l-1.2.7-1.5-.9.9-1.5A5.5 5.5 0 012.5 8c0-.7.1-1.4.4-2L2 4.5 3.5 3.6l1.2.7a5.5 5.5 0 011.8-.8L7 2h2l.5 1.5a5.5 5.5 0 011.8.8l1.2-.7 1.5.9-.9 1.5c.3.6.4 1.3.4 2z" />
    </SvgIcon>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M2.5 8.5l4 4L13.5 3.5" />
    </SvgIcon>
  );
}

export function IconX(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </SvgIcon>
  );
}

export function IconSend(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M14 2L7 9M14 2l-4 12-3-5-5-3z" />
    </SvgIcon>
  );
}

export function IconBell(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M4 6a4 4 0 018 0c0 4 2 5 2 5H2s2-1 2-5" />
      <path d="M6.5 13a1.5 1.5 0 003 0" />
    </SvgIcon>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" />
    </SvgIcon>
  );
}

export function IconList(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M3 4h10M3 8h6M3 12h8" />
    </SvgIcon>
  );
}

export function IconArrowUp(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M8 12V4M5 7l3-3 3 3" />
    </SvgIcon>
  );
}

export function IconPulse(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M2 8h3l2-5 2 10 2-5h3" />
    </SvgIcon>
  );
}

export function IconGrid(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M6 2v12M10 2v12M2 6h12M2 10h12" />
    </SvgIcon>
  );
}

export function IconRefresh(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M13 3v4h-4" />
      <path d="M3 8a5 5 0 019-2l1 1" />
      <path d="M3 13V9h4" />
      <path d="M13 8a5 5 0 01-9 2l-1-1" />
    </SvgIcon>
  );
}

export function IconChevronRight(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M6 4l4 4-4 4" />
    </SvgIcon>
  );
}

export function IconTrendUp(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M8 1v14M4.5 4L8 1l3.5 3" />
    </SvgIcon>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/dashboard/icons.test.tsx 2>&1 | tail -10`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/icons.tsx tests/unit/dashboard/icons.test.tsx tests/unit/dashboard/test-helpers.tsx
git commit -m "feat: add minimal SVG icon system with 17 icons"
```

---

## Task 3: Tooltip component

**Files:**
- Create: `dashboard/src/components/tooltip.tsx`
- Create: `tests/unit/dashboard/tooltip.test.tsx`

- [ ] **Step 1: Write tooltip tests**

```tsx
// tests/unit/dashboard/tooltip.test.tsx
// @vitest-environment jsdom

import React from "react";
import { describe, expect, it } from "vitest";
import { render } from "./test-helpers";
import { Tooltip } from "../../../dashboard/src/components/tooltip";

function renderTooltip(label: string) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const { unmount } = render(
    <Tooltip label={label}><button>Hover me</button></Tooltip>,
    container,
  );
  return { container, unmount };
}

describe("Tooltip", () => {
  it("renders children", () => {
    const { container } = renderTooltip("Info");
    expect(container.textContent).toContain("Hover me");
    container.remove();
  });

  it("renders the tooltip label text in the DOM (hidden by CSS)", () => {
    const { container } = renderTooltip("Notifications");
    expect(container.textContent).toContain("Notifications");
    container.remove();
  });

  it("has position relative on the wrapper", () => {
    const { container } = renderTooltip("Info");
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.position).toBe("relative");
    container.remove();
  });
});
```

- [ ] **Step 2: Run tests — expect fail**

Run: `npx vitest run tests/unit/dashboard/tooltip.test.tsx 2>&1 | tail -10`

- [ ] **Step 3: Implement tooltip.tsx**

```tsx
"use client";

import React from "react";

export interface TooltipProps {
  label: string;
  children: React.ReactNode;
}

export function Tooltip({ label, children }: TooltipProps) {
  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      {children}
      <span
        className="pointer-events-none absolute bottom-full left-1/2 z-10 -translate-x-1/2 -translate-y-2 whitespace-nowrap opacity-0 transition-all duration-150 ease-out group-hover:translate-y-0 group-hover:opacity-100"
        style={{
          background: "#1a1a2e",
          color: "#fff",
          fontSize: "11px",
          fontWeight: 500,
          padding: "5px 10px",
          borderRadius: "6px",
          marginBottom: "8px",
        }}
      >
        {label}
        {/* Arrow */}
        <span
          style={{
            position: "absolute",
            top: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            borderWidth: "4px",
            borderStyle: "solid",
            borderColor: "#1a1a2e transparent transparent transparent",
          }}
        />
      </span>
    </div>
  );
}
```

Note: The tooltip uses CSS `group-hover` for visibility. The parent should have `group` class. For inline use, an alternative approach uses the `:hover` pseudo-class directly. Since Tailwind's `group-hover` requires a parent `group`, and many uses are standalone icon buttons, use a CSS-only approach instead:

Actually, let's use the simpler CSS-only approach with `peer`:

```tsx
"use client";

import React from "react";

export interface TooltipProps {
  label: string;
  children: React.ReactNode;
}

export function Tooltip({ label, children }: TooltipProps) {
  return (
    <div className="group" style={{ position: "relative", display: "inline-flex" }}>
      {children}
      <span
        className="pointer-events-none absolute bottom-full left-1/2 z-10 -translate-x-1/2 translate-y-1 whitespace-nowrap opacity-0 transition-all duration-150 ease-out group-hover:-translate-y-0 group-hover:opacity-100"
        style={{
          background: "#1a1a2e",
          color: "#fff",
          fontSize: "11px",
          fontWeight: 500,
          padding: "5px 10px",
          borderRadius: "6px",
          marginBottom: "8px",
        }}
      >
        {label}
        <span
          className="absolute left-1/2 top-full -translate-x-1/2"
          style={{
            borderWidth: "4px",
            borderStyle: "solid",
            borderColor: "#1a1a2e transparent transparent transparent",
          }}
        />
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npx vitest run tests/unit/dashboard/tooltip.test.tsx 2>&1 | tail -10`

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/tooltip.tsx tests/unit/dashboard/tooltip.test.tsx
git commit -m "feat: add reusable tooltip component"
```

---

## Task 4: Top navigation component

**Files:**
- Create: `dashboard/src/components/top-nav.tsx`
- Create: `tests/unit/dashboard/top-nav.test.tsx`

- [ ] **Step 1: Write top-nav tests**

Test the key behaviors: renders all 5 tabs, highlights active tab, shows Sign in when signed out, shows avatar when signed in.

```tsx
// tests/unit/dashboard/top-nav.test.tsx
// @vitest-environment jsdom

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "./test-helpers";

vi.mock("../../../dashboard/node_modules/next/link", () => ({
  default: ({ children, href, ...props }: any) =>
    React.createElement("a", { href, ...props }, children),
}));

vi.mock("../../../dashboard/node_modules/next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

import { TopNav } from "../../../dashboard/src/components/top-nav";

describe("TopNav", () => {
  function renderNav(props = {}) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const defaults = {
      stage: "active" as const,
      displayName: "Bolaji",
      onLogin: vi.fn(),
      onLogout: vi.fn(),
    };
    const { unmount } = render(
      React.createElement(TopNav, { ...defaults, ...props }),
      container,
    );
    return { container, unmount };
  }

  it("renders the indyfren logo", () => {
    const { container } = renderNav();
    expect(container.textContent).toContain("indyfren");
    container.remove();
  });

  it("renders all 5 navigation tabs", () => {
    const { container } = renderNav();
    const text = container.textContent ?? "";
    expect(text).toContain("Today");
    expect(text).toContain("Deals");
    expect(text).toContain("Wallet");
    expect(text).toContain("Reports");
    expect(text).toContain("Settings");
    container.remove();
  });

  it("shows Sign in button when signed out", () => {
    const { container } = renderNav({ stage: "signed_out" });
    expect(container.textContent).toContain("Sign in");
    container.remove();
  });

  it("shows user initial in avatar when signed in", () => {
    const { container } = renderNav({ stage: "active", displayName: "Bolaji" });
    expect(container.textContent).toContain("B");
    container.remove();
  });
});
```

- [ ] **Step 2: Run tests — expect fail**

Run: `npx vitest run tests/unit/dashboard/top-nav.test.tsx 2>&1 | tail -10`

- [ ] **Step 3: Implement top-nav.tsx**

Build the top nav with: gradient logo mark + wordmark, 5 tabs with icons (use `usePathname` for active state), right-side notification bell + search + avatar/sign-in. Each icon button wrapped in `<Tooltip>`.

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconBell,
  IconBarChart,
  IconCard,
  IconClock,
  IconDocument,
  IconGear,
  IconSearch,
} from "./icons";
import { Tooltip } from "./tooltip";

const navItems = [
  { href: "/dashboard", label: "Today", icon: IconClock },
  { href: "/dashboard/deals", label: "Deals", icon: IconCard },
  { href: "/dashboard/wallet", label: "Wallet", icon: IconDocument },
  { href: "/dashboard/reports", label: "Reports", icon: IconBarChart },
  { href: "/dashboard/settings", label: "Settings", icon: IconGear },
];

interface TopNavProps {
  stage: "signed_out" | "registering" | "wallet_pending" | "active";
  displayName: string | null;
  onLogin: () => void;
  onLogout: () => void;
}

export function TopNav({ stage, displayName, onLogin, onLogout }: TopNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className="flex items-center justify-between border-b px-8"
      style={{
        height: "var(--nav-height)",
        borderColor: "var(--border-default)",
      }}
    >
      {/* Left: logo + tabs */}
      <div className="flex items-center gap-8">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div
            className="flex items-center justify-center"
            style={{
              width: 28,
              height: 28,
              borderRadius: "var(--radius-logo)",
              background: "linear-gradient(135deg, #FF2D78, #FF6B9D)",
            }}
          >
            <span className="text-[13px] font-bold text-white">i</span>
          </div>
          <span
            className="font-bold"
            style={{
              fontSize: 15,
              letterSpacing: "-0.3px",
              color: "var(--text-primary)",
            }}
          >
            indyfren
          </span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-1 transition-colors duration-150"
                style={{
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  color: active
                    ? "var(--accent-pink)"
                    : "var(--text-secondary)",
                  background: active
                    ? "var(--accent-pink-bg)"
                    : "transparent",
                  padding: "6px 16px",
                  borderRadius: "var(--radius-chip)",
                }}
              >
                <Icon size={14} />
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        <Tooltip label="Notifications">
          <button
            className="flex items-center justify-center transition-transform duration-150 hover:scale-105"
            style={{
              width: 36,
              height: 36,
              borderRadius: "var(--radius-button)",
              background: "var(--bg-input)",
            }}
          >
            <IconBell className="text-text-secondary" />
          </button>
        </Tooltip>

        <Tooltip label="Search ⌘K">
          <button
            className="flex items-center justify-center transition-transform duration-150 hover:scale-105"
            style={{
              width: 36,
              height: 36,
              borderRadius: "var(--radius-button)",
              background: "var(--bg-input)",
            }}
          >
            <IconSearch className="text-text-secondary" />
          </button>
        </Tooltip>

        {stage === "signed_out" ? (
          <button
            onClick={onLogin}
            className="text-[13px] font-semibold text-white transition-colors duration-150 hover:opacity-90"
            style={{
              background: "var(--accent-blue)",
              padding: "8px 16px",
              borderRadius: "var(--radius-button)",
            }}
          >
            Sign in
          </button>
        ) : (
          <Tooltip label={`${displayName ?? "Profile"} — Profile`}>
            <button
              className="flex items-center justify-center transition-transform duration-150 hover:scale-105"
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background:
                  "linear-gradient(135deg, #2D7CF6, #6BA3FF)",
              }}
            >
              <span className="text-[12px] font-semibold text-white">
                {(displayName ?? "?")[0].toUpperCase()}
              </span>
            </button>
          </Tooltip>
        )}
      </div>
    </nav>
  );
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npx vitest run tests/unit/dashboard/top-nav.test.tsx 2>&1 | tail -10`

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/top-nav.tsx tests/unit/dashboard/top-nav.test.tsx
git commit -m "feat: add top navigation bar with icon tabs and tooltips"
```

---

## Task 5: Command bar component

**Files:**
- Create: `dashboard/src/components/command-bar.tsx`
- Create: `tests/unit/dashboard/command-bar.test.tsx`

- [ ] **Step 1: Write command-bar tests**

```tsx
// tests/unit/dashboard/command-bar.test.tsx
// @vitest-environment jsdom

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "./test-helpers";
import { CommandBar } from "../../../dashboard/src/components/command-bar";

describe("CommandBar", () => {
  it("renders placeholder text", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    render(<CommandBar />, container);
    expect(container.textContent).toContain("Search or ask Indyfren anything");
    container.remove();
  });

  it("renders the ⌘K shortcut badge", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    render(<CommandBar />, container);
    expect(container.textContent).toContain("⌘K");
    container.remove();
  });
});
```

- [ ] **Step 2: Run tests — expect fail**

- [ ] **Step 3: Implement command-bar.tsx**

```tsx
"use client";

import React, { useCallback } from "react";
import { IconSearch } from "./icons";

export function CommandBar() {
  const handleClick = useCallback(() => {
    const input = document.querySelector<HTMLTextAreaElement>(
      "#agent-console-input",
    );
    if (input) {
      input.scrollIntoView({ behavior: "smooth", block: "center" });
      input.focus();
    }
  }, []);

  return (
    <button
      onClick={handleClick}
      className="flex w-full items-center transition-all duration-150"
      style={{
        height: "var(--command-bar-height)",
        background: "var(--bg-input)",
        borderRadius: "var(--radius-input)",
        padding: "0 16px",
        border: "1.5px solid transparent",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--border-default)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "transparent";
      }}
    >
      <IconSearch size={14} className="mr-2 text-text-placeholder" />
      <span
        className="flex-1 text-left"
        style={{ fontSize: 13, color: "var(--text-placeholder)" }}
      >
        Search or ask Indyfren anything...
      </span>
      <span
        style={{
          background: "var(--accent-pink-bg)",
          color: "var(--accent-pink)",
          fontSize: 11,
          fontWeight: 600,
          padding: "4px 10px",
          borderRadius: "var(--radius-badge)",
        }}
      >
        ⌘K
      </span>
    </button>
  );
}
```

- [ ] **Step 4: Run tests — expect pass**

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/command-bar.tsx tests/unit/dashboard/command-bar.test.tsx
git commit -m "feat: add command bar component"
```

---

## Task 6: Rewrite dashboard layout (sidebar → top nav)

**Files:**
- Modify: `dashboard/src/app/dashboard/layout.tsx`
- Modify: `dashboard/src/lib/consumer-copy.ts`

- [ ] **Step 1: Rewrite layout.tsx**

Replace the entire sidebar grid with the `TopNav` component + single-column content area. The layout keeps the auth state logic (login/logout/stage) but passes it to `TopNav` instead of rendering a sidebar.

Key changes:
- Remove `<aside>` with `surface-card`, `eyebrow`, `display-title`, nav links, workspace status, auth buttons
- Remove the `md:grid-cols-[280px_minmax(0,1fr)]` grid
- Add `<TopNav>` at the top
- Content renders full-width below with page padding
- Keep `useAuth()` hook — pass `stage`, `creator.display_name`, `login`, `logout` to `TopNav`
- Keep the `DashboardAuthGate` wrapping of children (if it exists in the page, not layout)

```tsx
"use client";

import { useAuth } from "@/lib/privy";
import { TopNav } from "@/components/top-nav";

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { creator, login, logout, stage } = useAuth();

  return (
    <main className="min-h-screen" style={{ background: "var(--bg-canvas)" }}>
      <TopNav
        stage={stage}
        displayName={creator?.display_name ?? null}
        onLogin={login}
        onLogout={() => { void logout(); }}
      />
      <div
        className="mx-auto max-w-[1200px]"
        style={{ padding: "var(--space-page)" }}
      >
        {children}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Update consumer-copy.ts**

Remove `getDashboardShellCopy()` and `getDashboardShellStatusCopy()` if they're only used in the old sidebar. Keep any functions used elsewhere. Check for other imports before removing.

- [ ] **Step 3: Run all existing tests**

Run: `npx vitest run 2>&1 | tail -20`

Some tests may break due to the removed sidebar elements or changed class names. Fix any test failures that are directly caused by the layout change (e.g., tests looking for sidebar text). Note: page-level component tests may fail because they reference old CSS classes — those get fixed in later tasks.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/app/dashboard/layout.tsx dashboard/src/lib/consumer-copy.ts
git commit -m "feat: replace sidebar layout with top navigation bar"
```

---

## Task 7: Rewrite dashboard-home-hero.tsx

**Files:**
- Modify: `dashboard/src/components/dashboard-home-hero.tsx`
- Modify: `tests/unit/dashboard/home-state.test.ts` (if assertions change)

- [ ] **Step 1: Rewrite the hero component**

Replace the current paper-panel hero with the new gradient background hero. Key changes:
- Background: `var(--gradient-hero)` with `var(--radius-hero)` radius and `var(--space-hero-padding)` padding
- Greeting: time-aware ("Good morning/afternoon/evening, {name}") at 28px/700/-0.4px
- Summary line: colored keywords — approvals in pink, follow-ups in blue
- Empty state: "All clear — you're up to date"
- Primary CTA: blue filled with `IconCheck`, hidden if no approvals
- Secondary CTA: outlined with `IconClock`, links to /dashboard/deals
- Remove all `paper-panel`, `eyebrow`, `display-title`, `cta-primary`, `cta-secondary` references
- Remove the info cards grid from the current hero (that info moves to the "At a glance" section)

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/unit/dashboard/home-state.test.ts 2>&1 | tail -10`

Fix any assertions that depended on the old hero structure.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/dashboard-home-hero.tsx tests/unit/dashboard/home-state.test.ts
git commit -m "feat: rewrite hero with gradient bg, time-aware greeting, icon CTAs"
```

---

## Task 8: Rewrite dashboard-support-rail.tsx

**Files:**
- Modify: `dashboard/src/components/dashboard-support-rail.tsx`

- [ ] **Step 1: Rewrite the support rail**

Replace the current `surface-card` sections with the new design:
- Three sections separated by 1px `var(--border-default)` dividers with `var(--space-section)` spacing
- Each section header: icon + label (left) + "View all →" link (right, `var(--accent-blue)`)
- **Opportunities**: `IconCard` header, cards with `var(--radius-button)`, first card gets blue tint
- **Recent activity**: `IconPulse` header, rows with colored 32px icon containers + chevron
- **Connected channels**: `IconGrid` header, colored tag chips
- Empty states per section
- Hover effects: cards lift, rows highlight, tags scale
- Remove all `surface-card`, `eyebrow`, `text-fog`, `text-plum`, `bg-moss` references

- [ ] **Step 2: Run tests**

Run: `npx vitest run 2>&1 | grep -E "(FAIL|PASS|Tests)" | tail -5`

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/dashboard-support-rail.tsx
git commit -m "feat: rewrite support rail with section icons, dividers, hover states"
```

---

## Task 9: Rewrite agent-console.tsx

**Files:**
- Modify: `dashboard/src/components/agent-console.tsx`
- Modify: `tests/unit/dashboard/agent-console.test.tsx`

- [ ] **Step 1: Update agent console styling**

Key changes to the existing agent console:
- Container: `var(--bg-surface)` background, `var(--radius-card)` radius, 1px `var(--border-default)` border
- Header: green dot + "Chat with Indyfren" + `<Tooltip label="View thread history"><IconList /></Tooltip>`
- Quick prompts: add icons (`IconClock`, `IconCard`, `IconDocument`, `IconSend`), alternating pink/blue borders
- Messages: white bg, `var(--radius-input)` radius, 1px `var(--border-default)` border. Remove `rounded-[20px]` and `bg-parchment`.
- Approval cards: `var(--gradient-approval)` background, `IconCheck` on Approve, `IconX` on Skip
- Input: white bg, 1.5px `var(--border-light)` border, blue on focus, `<Tooltip label="Send message">` on send button with gradient bg and `IconArrowUp`
- Add `id="agent-console-input"` to the textarea so CommandBar can find it
- Remove all references to: `surface-card`, `display-title`, `eyebrow`, `bg-parchment`, `bg-ink`, `text-paper`, `text-fog`, `cta-primary`, `cta-secondary`, `bg-white/85`, `border-white/10`

- [ ] **Step 2: Update agent console tests**

Update `tests/unit/dashboard/agent-console.test.tsx` — fix any text or class assertions that break due to the redesign.

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/unit/dashboard/agent-console.test.tsx 2>&1 | tail -10`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/agent-console.tsx tests/unit/dashboard/agent-console.test.tsx
git commit -m "feat: restyle agent console with new design tokens and icons"
```

---

## Task 10: Update dashboard home page (page.tsx)

**Files:**
- Modify: `dashboard/src/app/dashboard/page.tsx`

- [ ] **Step 1: Update page layout**

Add CommandBar between hero and workspace. Update section labels and dividers:
- After hero: `<CommandBar />`
- "Workspace" label + divider before the two-column grid
- "At a glance" label + divider before insight cards
- Section labels use `heading-section` style (13px/600) with appropriate icon
- Dividers: 1px `var(--border-default)`
- Two-column grid: change from `lg:grid-cols-[1.05fr_0.95fr]` to equal `lg:grid-cols-2` with `var(--column-gap)` gap
- Insight cards: add icons and colored tint backgrounds per spec
- Remove all `paper-panel`, `surface-card`, `eyebrow`, `display-title`, `text-fog` references

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/unit/dashboard/home-state.test.ts 2>&1 | tail -10`

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/app/dashboard/page.tsx
git commit -m "feat: update home page with command bar, section dividers, icon labels"
```

---

## Task 11: Update dashboard-auth-gate.tsx

**Files:**
- Modify: `dashboard/src/components/dashboard-auth-gate.tsx`

- [ ] **Step 1: Replace old design classes**

Replace all instances of:
- `eyebrow` → remove (use heading-section style inline)
- `display-title` → remove (use 28px/700 system font)
- `bg-white/75` → `bg-canvas`
- `bg-parchment` → `bg-input`
- `bg-ink` → use `var(--accent-blue)` for primary actions
- `text-paper` → `text-white`
- `text-fog` → `text-text-tertiary`
- `text-ink` → `text-text-primary`
- `text-plum` → `text-accent-pink`
- `border-blush` → `border-accent-pink-border`
- `cta-primary` → inline blue button style
- `cta-secondary` → inline outlined button style
- `surface-card` → simple border with `var(--border-default)`

- [ ] **Step 2: Run existing auth-gate tests**

Run: `npx vitest run tests/unit/dashboard/auth-state.test.ts 2>&1 | tail -10`

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/dashboard-auth-gate.tsx
git commit -m "feat: restyle auth gate with new design tokens"
```

---

## Task 12: Update remaining components (deal-card, wallet-balance, morning-brief, platform-connect, profile-settings-form)

**Files:**
- Modify: `dashboard/src/components/deal-card.tsx`
- Modify: `dashboard/src/components/wallet-balance.tsx`
- Modify: `dashboard/src/components/morning-brief.tsx`
- Modify: `dashboard/src/components/platform-connect.tsx`
- Modify: `dashboard/src/components/profile-settings-form.tsx`

- [ ] **Step 1: Update deal-card.tsx**

Replace: `bg-parchment` → `bg-surface`, `text-ink` → `text-text-primary`, `text-fog` → `text-text-tertiary`, `text-plum` → `text-accent-pink`. Remove shadows, use `var(--border-default)` border with `var(--radius-button)` radius.

- [ ] **Step 2: Update wallet-balance.tsx**

Replace: `bg-ink` → use `var(--accent-blue-bg)` with `var(--accent-blue-border)` border, `text-paper` → `text-text-primary`, `eyebrow` → heading-section style, `shadow-card` → remove.

- [ ] **Step 3: Update morning-brief.tsx**

Replace: `bg-parchment` → `bg-surface`, `bg-white/70` → `bg-canvas`, `text-ink` → `text-text-primary`, `text-fog` → `text-text-tertiary`, `text-plum` → `text-accent-pink`, `eyebrow` → remove, `shadow-card` → remove, `border-black/10` → `border-border-default`.

- [ ] **Step 4: Update platform-connect.tsx**

Replace: `eyebrow` → remove, `display-title` → 28px/700 system font, `bg-white/75` → `bg-canvas`, `bg-parchment` → `bg-input`, `text-ink` → `text-text-primary`, `text-fog` → `text-text-tertiary`, `text-moss` → `text-accent-green-text`, `text-blush` → `text-accent-pink`, `bg-moss/15` → `bg-accent-green-bg`, `border-blush` → use accent-pink-border.

- [ ] **Step 5: Update profile-settings-form.tsx**

Replace: `eyebrow` → remove, `display-title` → heading style, `bg-white/75` → `bg-canvas`, `bg-parchment` → `bg-input`, `text-ink` → `text-text-primary`, `text-fog` → `text-text-tertiary`, `text-paper` → `text-white`.

- [ ] **Step 6: Run all tests**

Run: `npx vitest run 2>&1 | tail -20`

- [ ] **Step 7: Commit**

```bash
git add dashboard/src/components/deal-card.tsx dashboard/src/components/wallet-balance.tsx dashboard/src/components/morning-brief.tsx dashboard/src/components/platform-connect.tsx dashboard/src/components/profile-settings-form.tsx
git commit -m "feat: restyle remaining components with new design tokens"
```

---

## Task 13: Update sub-pages (deals, wallet, reports, settings)

**Files:**
- Modify: `dashboard/src/app/dashboard/deals/page.tsx`
- Modify: `dashboard/src/app/dashboard/wallet/page.tsx`
- Modify: `dashboard/src/app/dashboard/reports/page.tsx`
- Modify: `dashboard/src/app/dashboard/settings/page.tsx`

- [ ] **Step 1: Update deals page**

Replace all old design classes. Add `IconCard` to the page header. Use sentence case. Replace `paper-panel`, `rounded-card`, `eyebrow`, `display-title` with new tokens. Deal stage columns get subtle colored headers.

- [ ] **Step 2: Update wallet page**

Replace old classes. Add `IconDocument` to header. Remove `bg-ink` funding banner — use `var(--accent-blue-bg)` with blue border instead. Transaction list: remove parchment bg, use surface/border-default.

- [ ] **Step 3: Update reports page**

Replace old classes. Add `IconBarChart` to header. Financial stat cards: use colored tint backgrounds (green for income, pink for expenses, blue for pipeline). Platform analytics: clean borders, new tokens.

- [ ] **Step 4: Update settings page**

Replace old classes. Add icons to each section header. Add sign-out button at the bottom of the page (moved from old sidebar). Use new form input styling (bg-input, border-light, focus:border-focus).

- [ ] **Step 5: Run all tests**

Run: `npx vitest run 2>&1 | tail -20`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/app/dashboard/deals/page.tsx dashboard/src/app/dashboard/wallet/page.tsx dashboard/src/app/dashboard/reports/page.tsx dashboard/src/app/dashboard/settings/page.tsx
git commit -m "feat: restyle all sub-pages with vibrant creator minimalism tokens"
```

---

## Task 14: Full verification

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run 2>&1 | tail -30`
Expected: All tests pass (240+ tests)

- [ ] **Step 2: Build the dashboard**

Run: `cd dashboard && npx next build 2>&1 | tail -20`
Expected: Build succeeds with no errors

- [ ] **Step 3: Visual check**

Start the dev servers:
```bash
npm run dev &
cd dashboard && npm run dev &
```

Open `http://localhost:3001/dashboard` and verify:
- Top nav with icon tabs, pink active state, tooltips on hover
- Hero with gradient background, time-aware greeting, colored summary
- Command bar with ⌘K badge
- "Workspace" section label + divider
- Chat workspace with icon quick prompts, gradient approval card, blue input focus
- Support rail with section icons, "View all" links, dividers, hover states
- "At a glance" section with colored insight cards
- All sub-pages (deals, wallet, reports, settings) render with new tokens
- No remnants of old design (no parchment, no serif fonts, no uppercase eyebrows, no card shadows)

- [ ] **Step 4: Final commit if any visual fixes needed**

```bash
git add -A
git commit -m "fix: visual polish after full verification"
```

---

## Summary

| Task | Description | New files | Modified files |
|------|-------------|-----------|---------------|
| 1 | Design tokens + Tailwind config | — | globals.css, tailwind.config.ts |
| 2 | Icon system (17 icons) | icons.tsx, icons.test.tsx, test-helpers.tsx | — |
| 3 | Tooltip component | tooltip.tsx, tooltip.test.tsx | — |
| 4 | Top navigation | top-nav.tsx, top-nav.test.tsx | — |
| 5 | Command bar | command-bar.tsx, command-bar.test.tsx | — |
| 6 | Layout rewrite (sidebar → top nav) | — | layout.tsx, consumer-copy.ts |
| 7 | Hero rewrite | — | dashboard-home-hero.tsx, home-state.test.ts |
| 8 | Support rail rewrite | — | dashboard-support-rail.tsx |
| 9 | Agent console restyle | — | agent-console.tsx, agent-console.test.tsx |
| 10 | Home page update | — | page.tsx |
| 11 | Auth gate restyle | — | dashboard-auth-gate.tsx |
| 12 | Remaining components (5) | — | deal-card, wallet-balance, morning-brief, platform-connect, profile-settings-form |
| 13 | Sub-pages (4) | — | deals, wallet, reports, settings pages |
| 14 | Full verification | — | — |
