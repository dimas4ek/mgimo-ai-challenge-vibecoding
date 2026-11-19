import { describe, expect, it } from "vitest";
import { HealthSchema } from "./index";

describe("HealthSchema", () => {
  it("принимает { status: 'ok' }", () => {
    expect(HealthSchema.parse({ status: "ok" })).toEqual({ status: "ok" });
  });

  it("отклоняет другой статус", () => {
    expect(HealthSchema.safeParse({ status: "down" }).success).toBe(false);
  });
});
