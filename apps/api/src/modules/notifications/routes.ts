import { fixtures, IdSchema, routes } from "@aihs/contract";
import { Hono } from "hono";
import { requireAuth, requireRole } from "../../auth/middleware";
import type { AppEnv } from "../../env";
import { apiError } from "../../http/errors";

/**
 * `GET /api/me/notifications`, `POST /api/me/notifications/:id/read` — только студент,
 * пользователь из сессии. Чужое или невалидный id → 404.
 *
 * ЗАГЛУШКА контракта #9: отдаёт фикстуры; реализация переводит на `service.ts`.
 */
export function notificationRoutes() {
  return new Hono<AppEnv>()
    .use("/api/me/notifications", requireAuth, requireRole("student"))
    .use("/api/me/notifications/*", requireAuth, requireRole("student"))
    .get(routes.me.notifications.list.path, (c) => c.json(fixtures.notifications))
    .post(routes.me.notifications.markRead.path, (c) => {
      const id = IdSchema.safeParse(c.req.param("id"));
      const found = id.success
        ? fixtures.notifications.items.find((n) => n.id === id.data)
        : undefined;
      return found
        ? c.json({ ...found, read: true })
        : apiError(c, 404, "not_found", "Уведомление не найдено");
    });
}
