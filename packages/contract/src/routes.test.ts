import { describe, expect, it } from "vitest";
import { z } from "zod";
import { buildPath, type RouteDef, routes } from "./routes";

function isRoute(v: unknown): v is RouteDef {
  return typeof v === "object" && v !== null && "method" in v && "path" in v;
}

/** Все листья дерева `routes` с их «адресом» вида `me.requests.get`. */
function flatten(node: object, prefix = ""): [string, RouteDef][] {
  return Object.entries(node).flatMap(([key, value]) => {
    const name = prefix ? `${prefix}.${key}` : key;
    if (isRoute(value)) return [[name, value] as [string, RouteDef]];
    return flatten(value as object, name);
  });
}

const all = flatten(routes);

describe("routes", () => {
  it("описывает все эндпоинты ядра", () => {
    expect(all.map(([name]) => name).sort()).toEqual(
      [
        "health",
        "auth.login",
        "auth.logout",
        "auth.me",
        "me.profile",
        "me.schedule",
        "me.grades",
        "me.demoReset",
        "me.discussions.comment",
        "me.discussions.create",
        "me.discussions.get",
        "me.discussions.list",
        "me.requests.list",
        "me.requests.create",
        "me.requests.get",
        "me.notifications.list",
        "me.notifications.markRead",
        "staff.requests.list",
        "staff.requests.changeStatus",
        "me.certificates.get",
        "public.certificates.verify",
      ].sort(),
    );
  });

  it.each(all)("%s: метод, путь /api/… и схема ответа", (_name, route) => {
    expect(["GET", "POST"]).toContain(route.method);
    // Сегменты в нижнем регистре, параметры — `:id` или `:requestId`.
    expect(route.path).toMatch(/^\/api(\/([a-z0-9_-]+|:[A-Za-z]\w*))+$/);
    expect(route.response).toBeInstanceOf(z.ZodType);
    if (route.method === "GET") expect(route.body).toBeUndefined();
  });

  it("пара метод + путь не повторяется", () => {
    const keys = all.map(([, r]) => `${r.method} ${r.path}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("студенческие роуты только под /api/me, без id студента в пути", () => {
    for (const [name, route] of all.filter(([n]) => n.startsWith("me."))) {
      expect(route.path, name).toMatch(/^\/api\/me\//);
      expect(route.path, name).not.toMatch(/student/);
    }
    for (const [name, route] of all.filter(([n]) => n.startsWith("staff."))) {
      expect(route.path, name).toMatch(/^\/api\/staff\//);
    }
  });

  it("публичные роуты (без входа) только под /api/public и только GET", () => {
    const pub = all.filter(([n]) => n.startsWith("public."));
    expect(pub.length).toBeGreaterThan(0);
    for (const [name, route] of pub) {
      expect(route.path, name).toMatch(/^\/api\/public\//);
      expect(route.method, name).toBe("GET");
    }
  });
});

describe("buildPath", () => {
  it("подставляет параметр", () => {
    expect(buildPath(routes.me.requests.get.path, { id: "abc" })).toBe("/api/me/requests/abc");
    expect(buildPath(routes.me.notifications.markRead.path, { id: "n1" })).toBe(
      "/api/me/notifications/n1/read",
    );
  });

  it("путь без параметров не меняется", () => {
    expect(buildPath(routes.me.grades.path)).toBe("/api/me/grades");
  });

  it("кодирует значение, чтобы нельзя было выйти из сегмента", () => {
    expect(buildPath(routes.me.requests.get.path, { id: "../x?y" })).toBe(
      "/api/me/requests/..%2Fx%3Fy",
    );
  });

  it("падает, если параметра нет", () => {
    const path: string = routes.me.requests.get.path;
    expect(() => buildPath(path as "/api/x")).toThrow(/нет параметра "id"/);
  });
});
