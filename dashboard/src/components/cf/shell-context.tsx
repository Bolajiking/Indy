"use client";

import { createContext, useContext } from "react";

export type SettingsPane =
  | "account"
  | "subscription"
  | "wallet"
  | "reports"
  | "connections"
  | "channels"
  | "appearance"
  | "referrals"
  | "usage";

export interface ShellCtxValue {
  settingsOpen: boolean;
  settingsPane: SettingsPane;
  openSettings: (pane?: SettingsPane) => void;
  closeSettings: () => void;
  libraryOpen: boolean;
  setLibrary: (v: boolean) => void;
  toggleLibrary: () => void;
  /** Send a prompt to the agent on the Today screen (navigates there). */
  askAgent: (text: string) => void;
}

export const ShellContext = createContext<ShellCtxValue>({
  settingsOpen: false,
  settingsPane: "account",
  openSettings: () => {},
  closeSettings: () => {},
  libraryOpen: false,
  setLibrary: () => {},
  toggleLibrary: () => {},
  askAgent: () => {},
});

export function useShell() {
  return useContext(ShellContext);
}
