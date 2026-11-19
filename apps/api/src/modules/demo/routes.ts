import { type Ok, routes } from "@aihs/contract";
import { Hono } from "hono";
import { requireAuth, requireRole } from "../../auth/middleware";
import type { AppEnv } from "../../env";

/**
 * `POST /api/me/demo-reset` — только студент, сбрасывает данные своего аккаунта (id из сессии).
 * Пока заглушка (контракт #23); реализация вызывает `resetStudentData` из `db/seed/reset.ts`.
 */
export function demoRoutes() {
  return new Hono<AppEnv>()
    .use(routes.me.demoReset.path, requireAuth, requireRole("student"))
    .post(routes.me.demoReset.path, (c) => c.json({ ok: true } satisfies Ok));
}
