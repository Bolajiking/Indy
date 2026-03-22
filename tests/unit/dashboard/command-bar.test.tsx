// @vitest-environment jsdom

import React from "react";
import { describe, expect, it } from "vitest";
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
