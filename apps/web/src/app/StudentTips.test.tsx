// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StudentTips } from "./StudentTips";

function open({ wide = true, reducedMotion = false } = {}) {
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: query === "(min-width: 90rem)" ? wide : !reducedMotion,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  vi.useFakeTimers();
  render(
    <MemoryRouter>
      <StudentTips />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const panel = () => screen.getByRole("complementary", { name: "Подсказки" });
const next = () => within(panel()).getByRole("button", { name: "Следующая подсказка" });
const tip = () => within(panel()).getByRole("heading", { level: 3 }).textContent;
const period = () => act(() => vi.advanceTimersByTime(8_000));

describe("подсказки студента", () => {
  it("на узком экране колонка отсутствует", () => {
    open({ wide: false });
    expect(screen.queryByRole("complementary", { name: "Подсказки" })).toBeNull();
  });

  it("автолистание возобновляется после ухода указателя или фокуса", () => {
    open();
    const first = tip();
    fireEvent.mouseEnter(panel());
    period();
    expect(tip()).toBe(first);

    fireEvent.mouseLeave(panel());
    fireEvent.focus(next());
    period();
    expect(tip()).toBe(first);

    fireEvent.blur(next());
    period();
    expect(tip()).not.toBe(first);
  });

  it("при уменьшенном движении обе стрелки листают без таймера", () => {
    open({ reducedMotion: true });
    const first = tip();
    period();
    expect(tip()).toBe(first);

    fireEvent.click(next());
    const second = tip();
    expect(second).not.toBe(first);
    period();
    expect(tip()).toBe(second);

    fireEvent.click(within(panel()).getByRole("button", { name: "Предыдущая подсказка" }));
    expect(tip()).toBe(first);
  });
});
