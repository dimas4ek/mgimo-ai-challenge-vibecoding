import { routes } from "@aihs/contract";
import { Hono } from "hono";
import { requireAuth, requireRole } from "../../auth/middleware";
import type { AppEnv } from "../../env";
import { apiError } from "../../http/errors";
import { getProfile } from "./service";

/** `GET /api/me/profile` — только студент, id из сессии. */
export function profileRoutes() {
  return new Hono<AppEnv>()
    .use(routes.me.profile.path, requireAuth, requireRole("student"))
    .get(routes.me.profile.path, async (c) => {
      const studentId = c.var.user.studentId;
      const profile = studentId ? await getProfile(c.var.db, studentId) : null;
      return profile ? c.json(profile) : apiError(c, 404, "not_found", "Профиль не найден");
    });
}
