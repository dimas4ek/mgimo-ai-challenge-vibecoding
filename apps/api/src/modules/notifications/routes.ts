import { IdSchema, routes } from "@aihs/contract";
import { Hono } from "hono";
import { requireAuth, requireRole } from "../../auth/middleware";
import type { AppEnv } from "../../env";
import { apiError } from "../../http/errors";
import { listNotifications, markRead } from "./service";

/**
 * `GET /api/me/notifications`, `POST /api/me/notifications/:id/read` — только студент,
 * пользователь из сессии (`c.var.user.id`). Чужое или невалидный id → 404.
 */
export function notificationRoutes() {
  return new Hono<AppEnv>()
    .use("/api/me/notifications", requireAuth, requireRole("student"))
    .use("/api/me/notifications/*", requireAuth, requireRole("student"))
    .get(routes.me.notifications.list.path, async (c) =>
      c.json(await listNotifications(c.var.db, c.var.user.id)),
    )
    .post(routes.me.notifications.markRead.path, async (c) => {
      const id = IdSchema.safeParse(c.req.param("id"));
      const updated = id.success ? await markRead(c.var.db, c.var.user.id, id.data) : null;
      return updated ? c.json(updated) : apiError(c, 404, "not_found", "Уведомление не найдено");
    });
}
