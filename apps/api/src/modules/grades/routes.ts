import { fixtures, routes } from "@aihs/contract";
import { Hono } from "hono";
import { requireAuth, requireRole } from "../../auth/middleware";
import type { AppEnv } from "../../env";

/** `GET /api/me/grades` — только студент, id из сессии. Пока отдаёт фикстуру (контракт #7). */
export function gradeRoutes() {
  return new Hono<AppEnv>()
    .use(routes.me.grades.path, requireAuth, requireRole("student"))
    .get(routes.me.grades.path, (c) => c.json(fixtures.grades));
}
