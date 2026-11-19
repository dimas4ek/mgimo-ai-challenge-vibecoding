import { HealthSchema } from "@aihs/contract";
import { describe, expect, it } from "vitest";
import { app } from "./app";

describe("GET /api/health", () => {
  it("отвечает 200 в форме HealthSchema", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    expect(HealthSchema.parse(await res.json())).toEqual({ status: "ok" });
  });
});
