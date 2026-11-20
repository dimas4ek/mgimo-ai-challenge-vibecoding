import { LoginInputSchema, type Me, type Ok, routes } from "@aihs/contract";
import { type Context, Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { AppDeps, AppEnv, SessionUser } from "../env";
import { apiError } from "../http/errors";
import { validate } from "../http/validate";
import { requireAuth } from "./middleware";
import { LoginRateLimiter } from "./rate-limit";
import {
  createSession,
  deleteSession,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  verifyCredentials,
} from "./session";

const toMe = (u: SessionUser): Me => ({ id: u.id, role: u.role, displayName: u.displayName });

/**
 * Адрес клиента для rate-limit. Если задан `ipHeader` (за Cloudflare — `cf-connecting-ip`,
 * его перезаписывает сам Cloudflare), адрес берётся из него, `X-Forwarded-For` не смотрим:
 * на Render последний адрес там — прокси платформы, общий для всех посетителей.
 * Иначе (за Caddy) это последний адрес в `X-Forwarded-For`: его дописывает сам прокси, а не клиент.
 */
function clientKey(c: Context, ipHeader: string | undefined): string {
  if (ipHeader) return c.req.header(ipHeader)?.trim() || "unknown";
  const forwarded = c.req.header("x-forwarded-for")?.split(",").at(-1)?.trim();
  return forwarded || c.req.header("x-real-ip") || "local";
}

/**
 * `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.
 * Вход ставит cookie `aihs_session` (`httpOnly; SameSite=Lax; Path=/`, `Secure` в проде),
 * ошибка входа всегда одна: 401 `invalid_credentials` «Неверный логин или пароль»;
 * частые неудачные попытки → 429 `rate_limited`.
 */
export function authRoutes(deps: AppDeps) {
  const secure = deps.secureCookies ?? process.env.NODE_ENV === "production";
  const limit = deps.loginRateLimit ?? { max: 10, windowMs: 15 * 60 * 1000 };
  const limiter = new LoginRateLimiter(limit.max, limit.windowMs);
  const ipHeader = (deps.clientIpHeader ?? process.env.CLIENT_IP_HEADER)?.trim() || undefined;

  return new Hono<AppEnv>()
    .post(routes.auth.login.path, validate("json", LoginInputSchema), async (c) => {
      const now = c.var.now();
      const key = clientKey(c, ipHeader);
      if (limiter.isBlocked(key, now)) {
        return apiError(c, 429, "rate_limited", "Слишком много попыток. Попробуйте через 15 минут");
      }
      const { login, password } = c.req.valid("json");
      const user = await verifyCredentials(c.var.db, login, password);
      if (!user) {
        limiter.fail(key, now);
        return apiError(c, 401, "invalid_credentials", "Неверный логин или пароль");
      }
      const token = await createSession(c.var.db, user.id, now);
      setCookie(c, SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: "Lax",
        secure,
        path: "/",
        maxAge: SESSION_TTL_MS / 1000,
      });
      return c.json(toMe(user));
    })
    .post(routes.auth.logout.path, async (c) => {
      const token = getCookie(c, SESSION_COOKIE);
      if (token) await deleteSession(c.var.db, token);
      deleteCookie(c, SESSION_COOKIE, { path: "/", secure });
      return c.json({ ok: true } satisfies Ok);
    })
    .get(routes.auth.me.path, requireAuth, (c) => c.json(toMe(c.var.user)));
}
