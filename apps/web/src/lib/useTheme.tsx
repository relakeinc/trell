"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type Theme = "light" | "dark" | "system";

export type FontStyle = "default" | "display" | "system";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  accent: string;
  font: FontStyle;
  setTheme: (t: Theme) => void;
  setAccent: (a: string) => void;
  setFont: (f: FontStyle) => void;
}

const DEFAULT_ACCENT = "default";
const DEFAULT_FONT: FontStyle = "default";

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  resolvedTheme: "light",
  accent: DEFAULT_ACCENT,
  font: DEFAULT_FONT,
  setTheme: () => {},
  setAccent: () => {},
  setFont: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// The device status bar / PWA chrome colour. Updated in place (never removed)
// so React never sees a head node disappear from under it.
function syncThemeColor(resolved: "light" | "dark") {
  let meta = document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"][data-trell]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.setAttribute("data-trell", "");
    document.head.appendChild(meta);
  }
  meta.content = resolved === "dark" ? "#111111" : "#ffffff";
}

function applyThemeToDOM(resolved: "light" | "dark") {
  const root = document.documentElement;
  syncThemeColor(resolved);
  // Kill transitions for this frame so every element snaps to the new theme
  // together instead of animating at different speeds.
  root.classList.add("trell-theme-switching");
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => root.classList.remove("trell-theme-switching"));
  });
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");
  const [accent, setAccentState] = useState<string>(DEFAULT_ACCENT);
  const [font, setFontState] = useState<FontStyle>(DEFAULT_FONT);

  const setTheme = useCallback((t: Theme) => {
    const resolved = t === "system" ? getSystemTheme() : t;

    setThemeState(t);
    setResolvedTheme(resolved);
    localStorage.setItem("trell-theme", t);
    applyThemeToDOM(resolved);
  }, []);

  const setAccent = useCallback((a: string) => {
    setAccentState(a);
    localStorage.setItem("trell-accent", a);
    document.documentElement.setAttribute("data-accent", a);
  }, []);

  const setFont = useCallback((f: FontStyle) => {
    setFontState(f);
    localStorage.setItem("trell-font", f);
    document.documentElement.setAttribute("data-font", f);
  }, []);

  // Read synchronously from state inside the media listener without making the
  // listener effect depend on `theme` (that re-ran the whole init on every
  // toggle and double-applied the theme).
  const themeRef = useRef<Theme>("system");
  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

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

    const storedFont = (localStorage.getItem("trell-font") as FontStyle | null) ?? DEFAULT_FONT;
    setFontState(storedFont);
    document.documentElement.setAttribute("data-font", storedFont);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (themeRef.current === "system") {
        const r = getSystemTheme();
        setResolvedTheme(r);
        applyThemeToDOM(r);
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, accent, font, setTheme, setAccent, setFont }}>
      {children}
    </ThemeContext.Provider>
  );
}
