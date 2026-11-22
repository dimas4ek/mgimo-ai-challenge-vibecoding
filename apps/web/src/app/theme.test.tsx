// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { startThemeSync, useTheme } from "./theme";

it("синхронизирует тему и без смонтированных переключателей", () => {
  const media = Object.assign(new EventTarget(), { matches: false });
  const matchMedia = vi.spyOn(window, "matchMedia").mockReturnValue(media as MediaQueryList);
  localStorage.removeItem("aihs-theme");
  const stop = startThemeSync();
  const theme = () => document.documentElement.dataset.theme;
  const changeSystemTheme = (dark: boolean) => {
    media.matches = dark;
    media.dispatchEvent(new Event("change"));
  };
  const changeThemeInAnotherTab = (preference: "light" | "dark" | null) => {
    if (preference === null) localStorage.removeItem("aihs-theme");
    else localStorage.setItem("aihs-theme", preference);
    window.dispatchEvent(new StorageEvent("storage", { key: "aihs-theme" }));
  };

  try {
    expect(theme()).toBe("light");
    changeSystemTheme(true);
    expect(theme()).toBe("dark");

    changeThemeInAnotherTab("light");
    expect(theme()).toBe("light");
    const { result, unmount } = renderHook(useTheme);
    expect(result.current).toMatchObject({ theme: "light", preference: "light" });
    act(() => result.current.toggle());
    expect(result.current).toMatchObject({ theme: "dark", preference: "dark" });
    expect(theme()).toBe("dark");
    expect(localStorage.getItem("aihs-theme")).toBe("dark");
    unmount();

    changeSystemTheme(false);
    expect(theme()).toBe("dark");
    changeThemeInAnotherTab(null);
    expect(theme()).toBe("light");
  } finally {
    stop();
    matchMedia.mockRestore();
    localStorage.removeItem("aihs-theme");
    delete document.documentElement.dataset.theme;
  }
});
