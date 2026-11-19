import { fixtures, routes, ScheduleQuerySchema } from "@aihs/contract";
import { Hono } from "hono";
import { requireAuth, requireRole } from "../../auth/middleware";
import type { AppEnv } from "../../env";
import { validate } from "../../http/validate";

/** `GET /api/me/schedule?week=` — только студент, группа из сессии. Пока отдаёт фикстуру (контракт #6). */
export function scheduleRoutes() {
  return new Hono<AppEnv>()
    .use(routes.me.schedule.path, requireAuth, requireRole("student"))
    .get(routes.me.schedule.path, validate("query", ScheduleQuerySchema), (c) =>
      c.json(fixtures.weekSchedule),
    );
}
