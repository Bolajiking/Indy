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
