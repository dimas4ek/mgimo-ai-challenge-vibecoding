import { routes, ScheduleQuerySchema } from "@aihs/contract";
import { Hono } from "hono";
import { requireAuth, requireRole } from "../../auth/middleware";
import type { AppEnv } from "../../env";
import { apiError } from "../../http/errors";
import { validate } from "../../http/validate";
import { getWeekSchedule } from "./service";

/** `GET /api/me/schedule?week=` — только студент, группа из сессии. Без `week` — текущая неделя по МСК. */
export function scheduleRoutes() {
  return new Hono<AppEnv>()
    .use(routes.me.schedule.path, requireAuth, requireRole("student"))
    .get(routes.me.schedule.path, validate("query", ScheduleQuerySchema), async (c) => {
      const studentId = c.var.user.studentId;
      const { week } = c.req.valid("query");
      const schedule = studentId
        ? await getWeekSchedule(c.var.db, studentId, week, c.var.now())
        : null;
      return schedule ? c.json(schedule) : apiError(c, 404, "not_found", "Студент не найден");
    });
}
