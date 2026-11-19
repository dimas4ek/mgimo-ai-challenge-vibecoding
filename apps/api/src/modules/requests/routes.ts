import { CreateRequestInputSchema, IdSchema, routes } from "@aihs/contract";
import { Hono } from "hono";
import { requireAuth, requireRole } from "../../auth/middleware";
import type { AppEnv } from "../../env";
import { apiError } from "../../http/errors";
import { validate } from "../../http/validate";
import { createRequest, getRequest, listRequests } from "./service";

/** id студента — только из сессии. `requireRole("student")` гарантирует, что он есть. */
const studentIdOf = (c: { var: AppEnv["Variables"] }): string => {
  const id = c.var.user.studentId;
  if (!id) throw new Error("у студента в сессии нет studentId");
  return id;
};

/**
 * `POST /api/me/requests`, `GET /api/me/requests`, `GET /api/me/requests/:id` — только студент.
 * id студента берётся из сессии. Невалидный id в пути → 404 (как и чужая заявка): не раскрываем,
 * что ресурс существует.
 */
export function requestRoutes() {
  return new Hono<AppEnv>()
    .use("/api/me/requests", requireAuth, requireRole("student"))
    .use("/api/me/requests/*", requireAuth, requireRole("student"))
    .post(routes.me.requests.create.path, validate("json", CreateRequestInputSchema), async (c) => {
      const created = await createRequest(
        c.var.db,
        studentIdOf(c),
        c.req.valid("json"),
        c.var.now(),
      );
      return c.json(created, 201);
    })
    .get(routes.me.requests.list.path, async (c) =>
      c.json(await listRequests(c.var.db, studentIdOf(c))),
    )
    .get(routes.me.requests.get.path, async (c) => {
      const id = IdSchema.safeParse(c.req.param("id"));
      const found = id.success ? await getRequest(c.var.db, studentIdOf(c), id.data) : null;
      return found ? c.json(found) : apiError(c, 404, "not_found", "Заявка не найдена");
    });
}
