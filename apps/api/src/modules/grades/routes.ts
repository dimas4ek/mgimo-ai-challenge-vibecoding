import { routes } from "@aihs/contract";
import { Hono } from "hono";
import { requireAuth, requireRole } from "../../auth/middleware";
import type { AppEnv } from "../../env";
import { apiError } from "../../http/errors";
import { getGrades } from "./service";

/** `GET /api/me/grades` — только студент, id из сессии. */
export function gradeRoutes() {
  return new Hono<AppEnv>()
    .use(routes.me.grades.path, requireAuth, requireRole("student"))
    .get(routes.me.grades.path, async (c) => {
      const studentId = c.var.user.studentId;
      const grades = studentId ? await getGrades(c.var.db, studentId) : null;
      return grades ? c.json(grades) : apiError(c, 404, "not_found", "Успеваемость не найдена");
    });
}
