import {
  ChangeStatusInputSchema,
  routes,
  type StaffRequestItem,
  StaffRequestsQuerySchema,
} from "@aihs/contract";
import { Hono } from "hono";
import { requireAuth, requireRole } from "../../auth/middleware";
import type { AppEnv } from "../../env";
import { validate } from "../../http/validate";

/**
 * Кабинет сотрудника (#10), всё под `requireAuth` + `requireRole("staff")`:
 * без сессии → 401, студент → 403.
 *
 * - `GET /api/staff/requests?status=` — очередь заявок всех студентов (`listAllRequests`);
 * - `POST /api/staff/requests/:id/status` — смена статуса с комментарием (`changeRequestStatus`):
 *   пишет историю, студенту уходит уведомление (`notify`). Нет заявки или невалидный id → 404,
 *   заявка уже закрыта (`ready`/`rejected`) → 409.
 *
 * Контракт: тела хэндлеров — заглушки, реализация в следующем PR.
 */
export function staffRoutes() {
  return new Hono<AppEnv>()
    .use("/api/staff/*", requireAuth, requireRole("staff"))
    .get(routes.staff.requests.list.path, validate("query", StaffRequestsQuerySchema), (c) =>
      c.json([] satisfies StaffRequestItem[]),
    )
    .post(
      routes.staff.requests.changeStatus.path,
      validate("json", ChangeStatusInputSchema),
      () => {
        throw new Error("not implemented");
      },
    );
}
