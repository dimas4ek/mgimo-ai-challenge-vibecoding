// Общие для vite.config.ts (Workbox) и приложения (выход) имена офлайн-кэша.
// Без DOM-типов: этот файл компилирует и tsconfig.node.json (для vite.config.ts).

/** Кэш ответов API для офлайна: расписание и текущий пользователь. Чистится при выходе. */
export const API_CACHE = "aihs-api";

/** Какие запросы API кэшируем: без них офлайн не открыть расписание (охрана маршрутов ждёт `me`). */
export const OFFLINE_API_PATHS = ["/api/me/schedule", "/api/auth/me"] as const;
