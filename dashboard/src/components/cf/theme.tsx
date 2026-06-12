"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Theme = "dark" | "light";

interface ThemeCtx {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx>({
  theme: "dark",
  setTheme: () => {},
  toggle: () => {},
});

const STORAGE_KEY = "indyfren_theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const stageRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (saved === "light" || saved === "dark") setThemeState(saved);
    } catch {}
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {}
  }, []);

  const toggle = useCallback(
    () => setTheme(theme === "dark" ? "light" : "dark"),
    [theme, setTheme],
  );

  // Force a synchronous subtree reflow on theme change so rgb(var(--ink)) re-resolves.
  useLayoutEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const el = stageRef.current;
    if (!el) return;
    const prev = el.style.display;
    el.style.display = "none";
    void el.offsetHeight;
    el.style.display = prev;
  }, [theme]);

  return (
    <Ctx.Provider value={{ theme, setTheme, toggle }}>
      <div className="app-stage" data-theme={theme} ref={stageRef}>
        {children}
      </div>
    </Ctx.Provider>
  );
}

export function useTheme() {
  return useContext(Ctx);
}
