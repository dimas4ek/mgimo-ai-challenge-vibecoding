import { ApiErrorSchema, HealthSchema, routes } from "@aihs/contract";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./app";
import { createDb, type DbHandle } from "./db/client";

let handle: DbHandle;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  handle = await createDb({ url: "" });
  await handle.migrate();
  app = createApp({ db: handle.db });
});

afterAll(async () => {
  await handle.close();
});

describe("app", () => {
  it("GET /api/health отвечает 200 в форме HealthSchema", async () => {
    const res = await app.request(routes.health.path);
    expect(res.status).toBe(200);
    expect(HealthSchema.parse(await res.json())).toEqual({ status: "ok" });
  });

  it("неизвестный путь → 404 в формате ApiError", async () => {
    const res = await app.request("/api/nope");
    expect(res.status).toBe(404);
    expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("not_found");
  });

  it("невалидный вход → 400 в формате ApiError", async () => {
    const res = await app.request(routes.auth.login.path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ login: "" }),
    });
    expect(res.status).toBe(400);
    expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("validation");
  });
});
