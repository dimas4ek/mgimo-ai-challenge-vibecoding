import { fixtures, routes } from "@aihs/contract";
import { Hono } from "hono";
import { requireAuth, requireRole } from "../../auth/middleware";
import type { AppEnv } from "../../env";

/** `GET /api/me/profile` — только студент, id из сессии. Пока отдаёт фикстуру (контракт #6). */
export function profileRoutes() {
  return new Hono<AppEnv>()
    .use(routes.me.profile.path, requireAuth, requireRole("student"))
    .get(routes.me.profile.path, (c) => c.json(fixtures.profile));
}
