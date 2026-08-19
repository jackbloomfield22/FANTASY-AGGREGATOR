"use client";

import { useCallback, useEffect, useState } from "react";

export type ThemePref = "dark" | "light" | "system";

const THEME_KEY = "fa-theme";
const COMPACT_KEY = "fa-compact";

export function applyTheme(pref: ThemePref) {
  const root = document.documentElement;
  if (pref === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", pref);
}

/** Display preferences persisted in localStorage. */
export function useDisplayPrefs() {
  const [theme, setThemeState] = useState<ThemePref>("system");
  const [compactCards, setCompactState] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => {
      try {
        const t = localStorage.getItem(THEME_KEY);
        if (t === "dark" || t === "light" || t === "system") setThemeState(t);
        setCompactState(localStorage.getItem(COMPACT_KEY) === "1");
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

  const setCompactCards = useCallback((v: boolean) => {
    setCompactState(v);
    try {
      localStorage.setItem(COMPACT_KEY, v ? "1" : "0");
      window.dispatchEvent(new StorageEvent("storage", { key: COMPACT_KEY, newValue: v ? "1" : "0" }));
    } catch {}
  }, []);

  return { theme, setTheme, compactCards, setCompactCards };
}

/** Read-only compact-cards preference that stays in sync across the app. */
export function useCompactCards(): boolean {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const read = () => {
      try {
        setCompact(localStorage.getItem(COMPACT_KEY) === "1");
      } catch {}
    };
    const id = setTimeout(read, 0);
    window.addEventListener("storage", read);
    return () => {
      clearTimeout(id);
      window.removeEventListener("storage", read);
    };
  }, []);
  return compact;
}
