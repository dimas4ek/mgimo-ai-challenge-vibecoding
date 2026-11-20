import { type Ok, routes } from "@aihs/contract";
import { Hono } from "hono";
import { requireAuth, requireRole } from "../../auth/middleware";
import { resetStudentData } from "../../db/seed/reset";
import type { AppEnv } from "../../env";
import { apiError } from "../../http/errors";

/**
 * `POST /api/me/demo-reset` — только студент: заявки и уведомления своего аккаунта возвращаются
 * к исходному сиду. id студента — только из сессии, чужие данные не трогаются.
 */
export function demoRoutes() {
  return new Hono<AppEnv>()
    .use(routes.me.demoReset.path, requireAuth, requireRole("student"))
    .post(routes.me.demoReset.path, async (c) => {
      const studentId = c.var.user.studentId;
      const done = studentId ? await resetStudentData(c.var.db, studentId, c.var.now()) : false;
      return done
        ? c.json({ ok: true } satisfies Ok)
        : apiError(c, 404, "not_found", "Студент не найден");
    });
}
