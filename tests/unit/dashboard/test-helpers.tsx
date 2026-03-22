import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";

export function render(element: React.ReactElement, container: HTMLElement) {
  const root = createRoot(container);
  act(() => { root.render(element); });
  return {
    unmount: () => { act(() => { root.unmount(); }); },
  };
}
