import type { Role } from "@aihs/contract";
import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../env";

/**
 * Пускает дальше только с живой сессией и кладёт пользователя в `c.var.user`.
 * Нет сессии → 401 `unauthorized`.
 *
 * `router.use("/api/me/*", requireAuth)`, затем `c.var.user.studentId` — id студента только отсюда.
 */
export const requireAuth: MiddlewareHandler<AppEnv> = async () => {
  throw new Error("not implemented");
};

/**
 * Пускает дальше только пользователя с ролью `role`; ставится после `requireAuth`.
 * Другая роль → 403 `forbidden`.
 *
 * `router.use("/api/staff/*", requireAuth, requireRole("staff"))`
 */
export function requireRole(role: Role): MiddlewareHandler<AppEnv> {
  void role;
  return async () => {
    throw new Error("not implemented");
  };
}
