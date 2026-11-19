import type { HttpHandler } from "msw";

/**
 * MSW-хендлеры всех роутов контракта на фикстурах `@aihs/contract`.
 * Используются в браузере (`VITE_USE_MOCKS=true`, только dev) и в тестах хуков.
 * Наполняется в реализации #12.
 */
export const handlers: HttpHandler[] = [];
