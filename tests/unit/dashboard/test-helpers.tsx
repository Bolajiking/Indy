import React, { act } from "../../../dashboard/node_modules/react";
import { createRoot } from "../../../dashboard/node_modules/react-dom/client";

export function render(element: React.ReactElement, container: HTMLElement) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  return {
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
}
