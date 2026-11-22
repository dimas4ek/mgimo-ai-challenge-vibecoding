// @vitest-environment jsdom

import { cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useCyberGlitch } from "./useCyberGlitch";

const arrows = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
];

function enterCode(target: Window | Element) {
  for (const key of arrows) fireEvent.keyDown(target, { key, code: key });
  fireEvent.keyDown(target, { key: "и", code: "KeyB" });
  return fireEvent.keyDown(target, { key: "ф", code: "KeyA" });
}

afterEach(cleanup);

describe("Киберлаги", () => {
  it("включаются только после полной последовательности и сбрасываются при новом монтировании", () => {
    const { result, unmount } = renderHook(useCyberGlitch);
    expect(result.current).toBe(false);

    for (const key of arrows) fireEvent.keyDown(window, { key, code: key });
    fireEvent.keyDown(window, { key: "b", code: "KeyB" });
    fireEvent.keyDown(window, { key: "q", code: "KeyQ" });
    fireEvent.keyDown(window, { key: "a", code: "KeyA" });
    expect(result.current).toBe(false);

    enterCode(window);
    expect(result.current).toBe(true);

    unmount();
    expect(renderHook(useCyberGlitch).result.current).toBe(false);
  });

  it("не активируются в поле ввода и не отменяют нажатия", () => {
    const { result } = renderHook(useCyberGlitch);
    render(<textarea aria-label="Комментарий" />);
    const input = screen.getByRole("textbox", { name: "Комментарий" });
    input.focus();

    expect(enterCode(input)).toBe(true);
    expect(result.current).toBe(false);
  });
});
