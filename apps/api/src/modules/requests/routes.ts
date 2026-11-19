import { CreateRequestInputSchema, fixtures, IdSchema, type Request, routes } from "@aihs/contract";
import { Hono } from "hono";
import { requireAuth, requireRole } from "../../auth/middleware";
import type { AppEnv } from "../../env";
import { apiError } from "../../http/errors";
import { validate } from "../../http/validate";

/**
 * `POST /api/me/requests`, `GET /api/me/requests`, `GET /api/me/requests/:id` — только студент.
 * id студента берётся из сессии. Невалидный id в пути → 404 (как и чужая заявка).
 *
 * ЗАГЛУШКА контракта #8: отдаёт фикстуры по схемам; реализация переводит на `service.ts`.
 */
export function requestRoutes() {
  return new Hono<AppEnv>()
    .use("/api/me/requests", requireAuth, requireRole("student"))
    .use("/api/me/requests/*", requireAuth, requireRole("student"))
    .post(routes.me.requests.create.path, validate("json", CreateRequestInputSchema), (c) => {
      const input = c.req.valid("json");
      const at = c.var.now().toISOString();
      const created: Request = {
        id: crypto.randomUUID(),
        type: input.type,
        status: "submitted",
        comment: input.comment ?? null,
        createdAt: at,
        updatedAt: at,
        history: [{ status: "submitted", at, comment: null }],
      };
      return c.json(created, 201);
    })
    .get(routes.me.requests.list.path, (c) => c.json(fixtures.requests))
    .get(routes.me.requests.get.path, (c) => {
      const id = IdSchema.safeParse(c.req.param("id"));
      const found = id.success ? fixtures.requestById[id.data] : undefined;
      return found ? c.json(found) : apiError(c, 404, "not_found", "Заявка не найдена");
    });
}
