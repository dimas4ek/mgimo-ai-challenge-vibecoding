import type { Role } from "@aihs/contract";
import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import type { AppEnv } from "../env";
import { apiError } from "../http/errors";
import { findSessionUser, SESSION_COOKIE } from "./session";

/**
 * Пускает дальше только с живой сессией и кладёт пользователя в `c.var.user`.
 * Нет сессии → 401 `unauthorized`.
 *
 * `router.use("/api/me/*", requireAuth)`, затем `c.var.user.studentId` — id студента только отсюда.
 */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  const user = token ? await findSessionUser(c.var.db, token, c.var.now()) : null;
  if (!user) return apiError(c, 401, "unauthorized", "Нужно войти в кабинет");
  c.set("user", user);
  await next();
};

/**
 * Пускает дальше только пользователя с ролью `role`; ставится после `requireAuth`.
 * Другая роль → 403 `forbidden`.
 *
 * `router.use("/api/staff/*", requireAuth, requireRole("staff"))`
 */
export function requireRole(role: Role): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (c.var.user.role !== role) return apiError(c, 403, "forbidden", "Недостаточно прав");
    await next();
  };
}
