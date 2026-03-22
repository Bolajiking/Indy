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
