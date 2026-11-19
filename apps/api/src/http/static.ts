import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../env";

/**
 * Раздаёт собранную SPA (`apps/web/dist`) в проде, где API и фронт живут на одном адресе.
 *
 * - Существующий файл из `dir` отдаётся как есть (`/assets/*` — с долгим кешем).
 * - Любой другой GET вне `/api/*` получает `index.html`: маршруты React Router открываются по прямой ссылке.
 * - `/api/*` не трогает: неизвестный API-путь остаётся JSON-ошибкой 404, а не страницей.
 *
 * Ставится после всех API-роутов: `app.get("*", spaStatic(dir))`.
 */
export function spaStatic(_dir: string): MiddlewareHandler<AppEnv> {
  throw new Error("not implemented");
}
