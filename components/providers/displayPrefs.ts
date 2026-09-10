"use client";

import { useCallback, useEffect, useState } from "react";

export type ThemePref = "dark" | "light" | "system";

const THEME_KEY = "fa-theme";

export function applyTheme(pref: ThemePref) {
  const root = document.documentElement;
  if (pref === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", pref);
}

/** Display preferences persisted in localStorage. */
export function useDisplayPrefs() {
  const [theme, setThemeState] = useState<ThemePref>("system");

  useEffect(() => {
    const id = setTimeout(() => {
      try {
        const t = localStorage.getItem(THEME_KEY);
        if (t === "dark" || t === "light" || t === "system") setThemeState(t);
      } catch {
        // storage unavailable — keep defaults
      }
    }, 0);
    return () => clearTimeout(id);
  }, []);

  const setTheme = useCallback((pref: ThemePref) => {
    setThemeState(pref);
    try {
      localStorage.setItem(THEME_KEY, pref);
    } catch {}
    applyTheme(pref);
  }, []);

  return { theme, setTheme };
}

