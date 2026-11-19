import { useSyncExternalStore } from "react";

export type ThemePreference = "system" | "light" | "dark";
export type Theme = "light" | "dark";

const STORAGE_KEY = "aihs-theme";

/**
 * Одно состояние темы на всё приложение (внешний store + `useSyncExternalStore`):
 * сколько бы переключателей ни было смонтировано, они показывают одно и то же.
 */
type Snapshot = { preference: ThemePreference; theme: Theme };

const listeners = new Set<() => void>();
let snapshot: Snapshot | null = null;

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Сохранённый выбор пользователя; в приватном окне хранилище может быть недоступно. */
export function readThemePreference(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function compute(preference: ThemePreference): Snapshot {
  return { preference, theme: preference === "system" ? systemTheme() : preference };
}

function commit(next: Snapshot) {
  snapshot = next;
  // Тот же атрибут ставит инлайн-скрипт в index.html до первой отрисовки.
  document.documentElement.dataset.theme = next.theme;
  for (const l of listeners) l();
}

function getSnapshot(): Snapshot {
  if (!snapshot) snapshot = compute(readThemePreference());
  return snapshot;
}

const SERVER_SNAPSHOT: Snapshot = { preference: "system", theme: "light" };

function subscribe(listener: () => void) {
  listeners.add(listener);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystem = () => {
    if (getSnapshot().preference === "system") commit(compute("system"));
  };
  // Выбор в другой вкладке.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) commit(compute(readThemePreference()));
  };
  mq.addEventListener("change", onSystem);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    mq.removeEventListener("change", onSystem);
    window.removeEventListener("storage", onStorage);
  };
}

/** Запомнить выбор и применить тему. `system` — следовать настройке ОС. */
export function setThemePreference(preference: ThemePreference): void {
  try {
    if (preference === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // без хранилища тема просто не запомнится
  }
  commit(compute(preference));
}

/** Тема приложения. Тумблер в профиле (#13) и в шапке пользуются этим же хуком. */
export function useTheme() {
  const { preference, theme } = useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);
  return {
    theme,
    preference,
    setPreference: setThemePreference,
    /** Переключить светлая ↔ тёмная (явный выбор). */
    toggle: () => setThemePreference(theme === "dark" ? "light" : "dark"),
  };
}
