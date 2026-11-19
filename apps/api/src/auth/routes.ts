import { fixtures, LoginInputSchema, type Me, type Ok, routes } from "@aihs/contract";
import { Hono } from "hono";
import type { AppDeps, AppEnv } from "../env";
import { validate } from "../http/validate";

/**
 * `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.
 * Вход ставит cookie `aihs_session` (`httpOnly; SameSite=Lax; Path=/`, `Secure` в проде),
 * ошибка входа всегда одна: 401 `invalid_credentials` «Неверный логин или пароль»;
 * частые неудачные попытки → 429 `rate_limited`.
 *
 * Пока заглушка: отдаёт фикстуры контракта.
 */
export function authRoutes(deps: AppDeps) {
  void deps;
  return new Hono<AppEnv>()
    .post(routes.auth.login.path, validate("json", LoginInputSchema), (c) =>
      c.json(fixtures.me.student satisfies Me),
    )
    .post(routes.auth.logout.path, (c) => c.json({ ok: true } satisfies Ok))
    .get(routes.auth.me.path, (c) => c.json(fixtures.me.student satisfies Me));
}
