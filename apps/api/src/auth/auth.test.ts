import { ApiErrorSchema, MeSchema, routes } from "@aihs/contract";
import { Hono } from "hono";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { createDb, type DbHandle } from "../db/client";
import { seed, seedAccounts } from "../db/seed";
import type { AppEnv } from "../env";
import { requireAuth, requireRole } from "./middleware";
import { SESSION_COOKIE, SESSION_TTL_MS } from "./session";

const NOW = new Date("2026-11-19T09:00:00Z");
let handle: DbHandle;

beforeAll(async () => {
  handle = await createDb({ url: "" });
  await handle.migrate();
  await seed(handle.db, { now: NOW });
});

afterAll(async () => {
  await handle.close();
});

type App = { request: (path: string, init?: RequestInit) => Response | Promise<Response> };

const login = (app: App, body: { login: string; password: string }, headers = {}) =>
  app.request(routes.auth.login.path, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

/** `aihs_session=<token>` из Set-Cookie ответа на вход. */
function sessionCookie(res: Response): string {
  const header = res.headers.get("set-cookie") ?? "";
  const cookie = header.split(";")[0] ?? "";
  expect(cookie.startsWith(`${SESSION_COOKIE}=`)).toBe(true);
  return cookie;
}

describe("вход", () => {
  it("успешный вход отдаёт Me и ставит httpOnly-cookie с SameSite=Lax", async () => {
    const app = createApp({ db: handle.db, now: () => NOW });
    const res = await login(app, seedAccounts.student);
    expect(res.status).toBe(200);
    expect(MeSchema.parse(await res.json())).toMatchObject({
      role: "student",
      displayName: "Мирослава Лебедянская",
    });
    const header = res.headers.get("set-cookie") ?? "";
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Lax");
    expect(header).toContain("Path=/");
    expect(header).not.toContain("Secure");
  });

  it("в проде cookie с флагом Secure", async () => {
    const app = createApp({ db: handle.db, now: () => NOW, secureCookies: true });
    const res = await login(app, seedAccounts.staff);
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("Secure");
  });

  it("неверный пароль и неизвестный логин дают одинаковую ошибку", async () => {
    const app = createApp({ db: handle.db, now: () => NOW });
    const wrongPassword = await login(app, { login: seedAccounts.student.login, password: "nope" });
    const unknownLogin = await login(app, { login: "nobody", password: "nope" });
    expect(wrongPassword.status).toBe(401);
    expect(unknownLogin.status).toBe(401);
    const a = ApiErrorSchema.parse(await wrongPassword.json());
    const b = ApiErrorSchema.parse(await unknownLogin.json());
    expect(a).toEqual(b);
    expect(a.error).toEqual({ code: "invalid_credentials", message: "Неверный логин или пароль" });
    expect(wrongPassword.headers.get("set-cookie")).toBeNull();
  });

  it("после лимита неудачных попыток — 429 даже с верным паролем", async () => {
    const app = createApp({
      db: handle.db,
      now: () => NOW,
      loginRateLimit: { max: 3, windowMs: 60_000 },
    });
    const ip = { "x-forwarded-for": "203.0.113.7" };
    for (let i = 0; i < 3; i++) {
      expect((await login(app, { login: "student", password: "nope" }, ip)).status).toBe(401);
    }
    const blocked = await login(app, seedAccounts.student, ip);
    expect(blocked.status).toBe(429);
    expect(ApiErrorSchema.parse(await blocked.json()).error.code).toBe("rate_limited");
    // Другой адрес не заблокирован.
    const other = await login(app, seedAccounts.student, { "x-forwarded-for": "203.0.113.8" });
    expect(other.status).toBe(200);
  });
});

describe("сессия", () => {
  it("GET /api/auth/me без сессии → 401", async () => {
    const app = createApp({ db: handle.db, now: () => NOW });
    const res = await app.request(routes.auth.me.path);
    expect(res.status).toBe(401);
    expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("unauthorized");
  });

  it("с cookie отдаёт текущего пользователя", async () => {
    const app = createApp({ db: handle.db, now: () => NOW });
    const cookie = sessionCookie(await login(app, seedAccounts.student2));
    const res = await app.request(routes.auth.me.path, { headers: { cookie } });
    expect(res.status).toBe(200);
    expect(MeSchema.parse(await res.json()).displayName).toBe("Тихон Колосовский");
  });

  it("logout удаляет сессию на сервере: старая cookie больше не работает", async () => {
    const app = createApp({ db: handle.db, now: () => NOW });
    const cookie = sessionCookie(await login(app, seedAccounts.student));
    const out = await app.request(routes.auth.logout.path, { method: "POST", headers: { cookie } });
    expect(out.status).toBe(200);
    expect(await out.json()).toEqual({ ok: true });
    const res = await app.request(routes.auth.me.path, { headers: { cookie } });
    expect(res.status).toBe(401);
  });

  it("просроченная сессия → 401", async () => {
    let now = NOW;
    const app = createApp({ db: handle.db, now: () => now });
    const cookie = sessionCookie(await login(app, seedAccounts.student));
    now = new Date(NOW.getTime() + SESSION_TTL_MS + 1000);
    const res = await app.request(routes.auth.me.path, { headers: { cookie } });
    expect(res.status).toBe(401);
  });
});

describe("requireRole", () => {
  // Мини-приложение со staff-роутом: так же подключат свои роутеры #6–#10.
  function staffApp() {
    const app = createApp({ db: handle.db, now: () => NOW });
    const guarded = new Hono<AppEnv>()
      .use(async (c, next) => {
        c.set("db", handle.db);
        c.set("now", () => NOW);
        await next();
      })
      .get("/api/staff/ping", requireAuth, requireRole("staff"), (c) =>
        c.json({ studentId: c.var.user.studentId }),
      );
    return { app, guarded };
  }

  it("студент на staff-роуте получает 403", async () => {
    const { app, guarded } = staffApp();
    const cookie = sessionCookie(await login(app, seedAccounts.student));
    const res = await guarded.request("/api/staff/ping", { headers: { cookie } });
    expect(res.status).toBe(403);
    expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("forbidden");
  });

  it("сотрудник проходит, у него нет studentId", async () => {
    const { app, guarded } = staffApp();
    const cookie = sessionCookie(await login(app, seedAccounts.staff));
    const res = await guarded.request("/api/staff/ping", { headers: { cookie } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ studentId: null });
  });

  it("без сессии staff-роут отвечает 401", async () => {
    const { guarded } = staffApp();
    expect((await guarded.request("/api/staff/ping")).status).toBe(401);
  });
});
