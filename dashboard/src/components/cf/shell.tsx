"use client";

import dynamic from "next/dynamic";
import { useCallback, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { ShellContext, type SettingsPane } from "./shell-context";

export { useShell } from "./shell-context";

const SettingsModal = dynamic(
  () => import("./settings-modal").then((mod) => mod.SettingsModal),
  {
    ssr: false,
    loading: () => null,
  },
);

export function ShellProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsPane, setSettingsPane] = useState<SettingsPane>("account");
  const [libraryOpen, setLibraryOpen] = useState(false);

  const openSettings = useCallback((pane?: SettingsPane) => {
    if (pane) setSettingsPane(pane);
    setSettingsOpen(true);
  }, []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const setLibrary = useCallback((v: boolean) => setLibraryOpen(v), []);
  const toggleLibrary = useCallback(() => setLibraryOpen((o) => !o), []);
  const askAgent = useCallback(
    (text: string) => {
      setSettingsOpen(false);
      setLibraryOpen(false);
      router.push("/dashboard?q=" + encodeURIComponent(text));
    },
    [router],
  );

  return (
    <ShellContext.Provider
      value={{
        settingsOpen,
        settingsPane,
        openSettings,
        closeSettings,
        libraryOpen,
        setLibrary,
        toggleLibrary,
        askAgent,
      }}
    >
      {children}
      {settingsOpen && <SettingsModal />}
    </ShellContext.Provider>
  );
}
