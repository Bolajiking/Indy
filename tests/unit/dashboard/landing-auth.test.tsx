// @vitest-environment jsdom

import React from "react";
import { act } from "../../../dashboard/node_modules/react";
import { describe, expect, it, vi } from "vitest";
import { render } from "./test-helpers";

const pushMock = vi.fn();
type MockLinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  children?: React.ReactNode;
  href: string;
};

vi.mock("../../../dashboard/node_modules/next/link", () => ({
  default: ({ children, href, ...props }: MockLinkProps) =>
    React.createElement("a", { href, ...props }, children),
}));

vi.mock("../../../dashboard/node_modules/next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import HomePage from "../../../dashboard/src/app/page";

describe("landing page auth CTAs", () => {
  function renderHome() {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const { unmount } = render(React.createElement(HomePage), container);
    return { container, unmount };
  }

  it("links sign-in CTAs to the dashboard login handoff", () => {
    const { container, unmount } = renderHome();
    const signIn = Array.from(container.querySelectorAll("a")).find(
      (anchor) => anchor.textContent === "Sign in",
    );

    expect(signIn?.getAttribute("href")).toBe("/dashboard?login=1");

    unmount();
    container.remove();
  });

  it("carries a landing composer prompt into the dashboard login flow", () => {
    const { container, unmount } = renderHome();
    const form = container.querySelector("form")!;

    act(() => {
      form.dispatchEvent(
        new SubmitEvent("submit", { bubbles: true, cancelable: true }),
      );
    });

    expect(pushMock).toHaveBeenCalledWith(
      "/dashboard?login=1&q=Find%20me%20brand%20deals%20for%20a%20wellness%20creator%20with%2080K%20followers%20on%20Instagram",
    );
    expect(sessionStorage.getItem("indyfren_pending_query")).toBe(
      "Find me brand deals for a wellness creator with 80K followers on Instagram",
    );

    unmount();
    container.remove();
  });
});
