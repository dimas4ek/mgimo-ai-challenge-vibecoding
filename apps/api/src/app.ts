import { type Health, routes } from "@aihs/contract";
import { Hono } from "hono";
import { authRoutes } from "./auth/routes";
import type { AppDeps, AppEnv } from "./env";
import { errorHandler, notFoundHandler } from "./http/errors";
import { requestRoutes } from "./modules/requests/routes";

/**
 * Hono-приложение без запуска сервера: его же используют тесты через `app.request()`.
 * Доменные роутеры (`src/modules/<домен>/routes.ts`) — `new Hono<AppEnv>()` с `requireAuth`,
 * подключаются здесь через `app.route("/", …)`.
 */
export function createApp(deps: AppDeps) {
  const now = deps.now ?? (() => new Date());
  const app = new Hono<AppEnv>();
  app.onError(errorHandler);
  app.notFound(notFoundHandler);
  app.use(async (c, next) => {
    c.set("db", deps.db);
    c.set("now", now);
    await next();
  });

  app.get(routes.health.path, (c) => c.json({ status: "ok" } satisfies Health));
  app.route("/", authRoutes(deps));
  app.route("/", requestRoutes());
  return app;
}
