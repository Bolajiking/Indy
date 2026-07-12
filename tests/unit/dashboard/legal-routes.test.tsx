// @vitest-environment jsdom

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "./test-helpers";

type MockLinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  children?: React.ReactNode;
  href: string;
};

vi.mock("../../../dashboard/node_modules/next/link", () => ({
  default: ({ children, href, ...props }: MockLinkProps) =>
    React.createElement("a", { href, ...props }, children),
}));

vi.mock("../../../dashboard/node_modules/next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import HomePage from "../../../dashboard/src/app/page";

describe("public legal surfaces", () => {
  it("links the landing page to privacy, terms, acceptable use, and support", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const { unmount } = render(React.createElement(HomePage), container);
    const hrefs = Array.from(container.querySelectorAll("a")).map((link) =>
      link.getAttribute("href"),
    );

    expect(hrefs).toEqual(
      expect.arrayContaining([
        "/privacy",
        "/terms",
        "/acceptable-use",
        "/support",
      ]),
    );

    unmount();
    container.remove();
  });
});
