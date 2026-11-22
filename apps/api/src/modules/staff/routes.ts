import {
  ChangeStatusInputSchema,
  IdSchema,
  routes,
  type StaffRequestItem,
  StaffRequestsQuerySchema,
} from "@aihs/contract";
import { Hono } from "hono";
import type { AppEnv } from "../../env";
import { apiError } from "../../http/errors";
import { validate } from "../../http/validate";
import { listAllRequests } from "../requests/service";
import { changeStatusAndNotify } from "./service";

/**
 * Кабинет сотрудника (#10), всё под `requireAuth` + `requireRole("staff")`:
 * без сессии → 401, студент → 403.
 *
 * - `GET /api/staff/requests?status=` — очередь заявок всех студентов (`listAllRequests`);
 * - `POST /api/staff/requests/:id/status` — смена статуса с комментарием (`changeStatusAndNotify`):
 *   пишет историю, студенту уходит уведомление. Нет заявки или невалидный id → 404,
 *   заявка уже закрыта (`ready`/`rejected`) → 409.
 */
export function staffRoutes() {
  return new Hono<AppEnv>()
    .get(routes.staff.requests.list.path, validate("query", StaffRequestsQuerySchema), async (c) =>
      c.json(await listAllRequests(c.var.db, c.req.valid("query"))),
    )
    .post(
      routes.staff.requests.changeStatus.path,
      validate("json", ChangeStatusInputSchema),
      async (c) => {
        const id = IdSchema.safeParse(c.req.param("id"));
        if (!id.success) return apiError(c, 404, "not_found", "Заявка не найдена");
        const result = await changeStatusAndNotify(
          c.var.db,
          id.data,
          c.req.valid("json"),
          c.var.now(),
        );
        if (result.ok) return c.json(result.item satisfies StaffRequestItem);
        return result.reason === "final"
          ? apiError(c, 409, "request_closed", "Заявка уже закрыта, статус менять нельзя")
          : apiError(c, 404, "not_found", "Заявка не найдена");
      },
    );
}
