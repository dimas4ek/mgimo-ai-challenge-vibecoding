import { useCallback, useEffect, useState } from "react";

export type ThemePreference = "system" | "light" | "dark";
export type Theme = "light" | "dark";

const STORAGE_KEY = "aihs-theme";
const media = () => window.matchMedia("(prefers-color-scheme: dark)");

/** Сохранённый выбор пользователя; в приватном окне хранилище может быть недоступно. */
export function readThemePreference(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function resolveTheme(pref: ThemePreference): Theme {
  if (pref !== "system") return pref;
  return media().matches ? "dark" : "light";
}

/** Ставит `data-theme` на `<html>`. Тот же код, что в инлайн-скрипте index.html (без вспышки при загрузке). */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

/** Тема приложения: выбор пользователя + следование системной теме при `system`. */
export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>(readThemePreference);
  const [theme, setTheme] = useState<Theme>(() => resolveTheme(preference));

  useEffect(() => {
    const update = () => {
      const next = resolveTheme(preference);
      setTheme(next);
      applyTheme(next);
    };
    update();
    if (preference !== "system") return;
    const mq = media();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [preference]);

  const setPreference = useCallback((pref: ThemePreference) => {
    try {
      if (pref === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, pref);
    } catch {
      // без хранилища тема просто не запомнится
    }
    setPreferenceState(pref);
  }, []);

  /** Переключить светлая ↔ тёмная (явный выбор). */
  const toggle = useCallback(
    () => setPreference(theme === "dark" ? "light" : "dark"),
    [theme, setPreference],
  );

  return { theme, preference, setPreference, toggle };
}
