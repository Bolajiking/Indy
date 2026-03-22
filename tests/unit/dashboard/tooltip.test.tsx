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
