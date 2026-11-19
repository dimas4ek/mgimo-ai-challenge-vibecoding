import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ApiErrorSchema, routes } from "@aihs/contract";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import type { Db } from "../db/client";

// Мини-сборка SPA во временном каталоге: index.html и один ассет с хешем в имени, как у Vite.
const dir = mkdtempSync(join(tmpdir(), "aihs-static-"));
mkdirSync(join(dir, "assets"));
writeFileSync(join(dir, "index.html"), "<!doctype html><div id=root></div>");
writeFileSync(join(dir, "assets", "index-abc123.js"), "console.log(1)");
writeFileSync(join(dir, "favicon.svg"), "<svg/>");

afterAll(() => rmSync(dir, { recursive: true, force: true }));

// Статика и health в БД не ходят: настоящая БД этим тестам не нужна.
const app = createApp({ db: {} as Db, staticDir: dir });

describe("spaStatic", () => {
  it("на / отдаёт index.html без долгого кеша", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("cache-control")).toBe("no-cache");
    expect(await res.text()).toContain("id=root");
  });

  it("маршрут SPA по прямой ссылке получает index.html", async () => {
    const res = await app.request("/schedule?week=2026-11-16");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("id=root");
  });

  it("ассет с хешем отдаётся как файл с долгим кешем", async () => {
    const res = await app.request("/assets/index-abc123.js");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("javascript");
    expect(res.headers.get("cache-control")).toContain("immutable");
    expect(await res.text()).toBe("console.log(1)");
  });

  it("файл из корня сборки отдаётся как есть", async () => {
    const res = await app.request("/favicon.svg");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("svg");
  });

  it("пропавший ассет — 404, а не index.html", async () => {
    const res = await app.request("/assets/missing.js");
    expect(res.status).toBe(404);
  });

  it("API работает как раньше, неизвестный API-путь — JSON 404", async () => {
    expect((await app.request(routes.health.path)).status).toBe(200);
    const res = await app.request("/api/no-such-thing");
    expect(res.status).toBe(404);
    expect(ApiErrorSchema.safeParse(await res.json()).success).toBe(true);
  });

  it("выйти за каталог сборки нельзя", async () => {
    const res = await app.request("/%2e%2e/%2e%2e/package.json");
    expect(await res.text()).not.toContain('"name"');
  });

  it("без staticDir статику не раздаёт", async () => {
    const res = await createApp({ db: {} as Db }).request("/");
    expect(res.status).toBe(404);
  });
});
