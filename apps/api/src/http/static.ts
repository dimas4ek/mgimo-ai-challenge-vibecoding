import { resolve } from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";
import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../env";

const isApiPath = (path: string) => path === "/api" || path.startsWith("/api/");

/**
 * Раздаёт собранную SPA (`apps/web/dist`) в проде, где API и фронт живут на одном адресе.
 *
 * - Существующий файл из `dir` отдаётся как есть (`/assets/*` — с долгим кешем).
 * - Любой другой GET вне `/api/*` получает `index.html`: маршруты React Router открываются по прямой ссылке.
 * - `/api/*` не трогает: неизвестный API-путь остаётся JSON-ошибкой 404, а не страницей.
 *
 * Ставится после всех API-роутов: `app.get("*", spaStatic(dir))`.
 */
export function spaStatic(dir: string): MiddlewareHandler<AppEnv> {
  const root = resolve(dir);
  const files = serveStatic<AppEnv>({ root });
  const indexHtml = serveStatic<AppEnv>({ root, path: "index.html" });

  return async (c, next) => {
    if (isApiPath(c.req.path)) return next();
    const isAsset = c.req.path.startsWith("/assets/");
    // Не нашёл файл — serveStatic зовёт переданный next (здесь пустой) и возвращает undefined.
    const notFound = async () => {};
    const file = (await files(c, notFound)) ?? (isAsset ? undefined : await indexHtml(c, notFound));
    // Пропавший ассет — честный 404: HTML вместо скрипта сломал бы страницу непонятной ошибкой.
    if (!file) return next();
    // Имена файлов в /assets/ содержат хеш содержимого (Vite), их можно кешировать навсегда.
    // index.html и остальное проверяются при каждом заходе, иначе после деплоя браузер держал бы старую сборку.
    // onFound у serveStatic не годится: он вызывается, когда ответ уже собран.
    file.headers.set("Cache-Control", isAsset ? "public, max-age=31536000, immutable" : "no-cache");
    return file;
  };
}
