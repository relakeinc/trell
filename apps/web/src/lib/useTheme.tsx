"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  accent: string;
  setTheme: (t: Theme) => void;
  setAccent: (a: string) => void;
}

const DEFAULT_ACCENT = "default";

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  resolvedTheme: "light",
  accent: DEFAULT_ACCENT,
  setTheme: () => {},
  setAccent: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyThemeToDOM(resolved: "light" | "dark") {
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");
  const [accent, setAccentState] = useState<string>(DEFAULT_ACCENT);

  const setTheme = useCallback((t: Theme) => {
    const resolved = t === "system" ? getSystemTheme() : t;

    setThemeState(t);
    setResolvedTheme(resolved);
    localStorage.setItem("trell-theme", t);

    if (!document.startViewTransition) {
      applyThemeToDOM(resolved);
      return;
    }

    document.startViewTransition(() => {
      applyThemeToDOM(resolved);
    });
  }, []);

  const setAccent = useCallback((a: string) => {
    setAccentState(a);
    localStorage.setItem("trell-accent", a);
    document.documentElement.setAttribute("data-accent", a);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("trell-theme") as Theme | null;
    const initial = stored ?? "system";
    const resolved = initial === "system" ? getSystemTheme() : initial;
    setThemeState(initial);
    setResolvedTheme(resolved);
    applyThemeToDOM(resolved);

    const storedAccent = localStorage.getItem("trell-accent") ?? DEFAULT_ACCENT;
    setAccentState(storedAccent);
    document.documentElement.setAttribute("data-accent", storedAccent);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (theme === "system") {
        const r = getSystemTheme();
        setResolvedTheme(r);
        applyThemeToDOM(r);
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, accent, setTheme, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}
