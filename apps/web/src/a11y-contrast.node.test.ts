// Аудит контраста дизайн-токенов (WCAG AA): читаем цвета обеих тем из index.css и проверяем
// пары «текст / фон», которые реально встречаются в интерфейсе. Поменяли токен — тест скажет,
// если контраст упал ниже 4.5:1 (обычный текст) или 3:1 (граница фокуса).
// Файл *.node.test.ts проверяет tsconfig.node.json (node-типы), а не браузерный tsconfig.
// CSS читаем с диска: Vitest отдаёт пустую строку даже для `?raw`-импорта .css.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./index.css", import.meta.url), "utf8");

function tokens(selector: ":root" | '[data-theme="dark"]'): Record<string, string> {
  // Селектор с начала строки; блок — от первой «{» после него (у :root есть соседний селектор).
  const start = css.indexOf(`\n${selector}`);
  const open = css.indexOf("{", start);
  const block = css.slice(open, css.indexOf("}", open));
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*(oklch\([^)]*\))/g)].map((m) => [m[1], m[2]]),
  );
}

/** oklch(L C H) → относительная яркость sRGB (WCAG). */
function luminance(oklch: string): number {
  const [L = 0, C = 0, H = 0] = (oklch.match(/[\d.]+/g) ?? []).map(Number);
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((v) => Math.min(1, Math.max(0, v)));
  const [r = 0, g = 0, bl = 0] = linear;
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
}

const contrast = (x: string, y: string) => {
  const [hi, lo] = [luminance(x), luminance(y)].sort((p, q) => q - p) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

/** Пары «текст на фоне», которые есть в интерфейсе (бейджи, кнопки, карточки, подписи). */
const TEXT_PAIRS: [string, string][] = [
  ["foreground", "background"],
  ["foreground", "surface"],
  ["foreground", "muted"],
  ["muted-foreground", "background"],
  ["muted-foreground", "surface"],
  ["muted-foreground", "muted"],
  ["primary", "background"],
  ["primary", "surface"],
  ["primary-foreground", "primary"],
  ["primary-soft-foreground", "primary-soft"],
  ["success", "success-soft"],
  ["success", "surface"],
  ["warning", "warning-soft"],
  ["danger", "danger-soft"],
  ["danger", "surface"],
  ["info", "info-soft"],
];

describe.each([
  ["светлая тема", ":root"],
  ["тёмная тема", '[data-theme="dark"]'],
] as const)("контраст: %s", (_name, selector) => {
  const theme = { ...tokens(":root"), ...tokens(selector) };

  it.each(TEXT_PAIRS)("%s на %s ≥ 4.5:1", (fg, bg) => {
    const [a, b] = [theme[fg], theme[bg]];
    expect(a && b, `нет токена --${fg} или --${bg}`).toBeTruthy();
    expect(contrast(a ?? "", b ?? "")).toBeGreaterThanOrEqual(4.5);
  });

  it.each(["background", "surface"])("кольцо фокуса на %s ≥ 3:1", (bg) => {
    expect(contrast(theme.ring ?? "", theme[bg] ?? "")).toBeGreaterThanOrEqual(3);
  });
});
