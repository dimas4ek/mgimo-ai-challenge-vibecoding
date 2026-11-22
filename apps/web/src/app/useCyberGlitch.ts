import { useEffect, useState } from "react";

const konamiCode: readonly string[] = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "KeyB",
  "KeyA",
];

const editingTarget = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

/**
 * Следит за последовательностью Konami в кабинете и возвращает состояние эффекта.
 * При новом монтировании эффект выключен. Нажатия в полях ввода не активируют его.
 */
export function useCyberGlitch(): boolean {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (active) return;

    const recentKeys: string[] = [];
    function onKeyDown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        event.shiftKey ||
        (event.target instanceof Element && event.target.closest(editingTarget))
      ) {
        recentKeys.length = 0;
        return;
      }
      if (event.repeat) return;

      // code распознаёт B и A по клавишам и в русской раскладке.
      recentKeys.push(event.code);
      if (recentKeys.length > konamiCode.length) recentKeys.shift();
      if (konamiCode.every((code, index) => recentKeys[index] === code)) setActive(true);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active]);

  return active;
}
