import { describe, expect, it } from "vitest";
import { addDays, mondayOf, moscowDate, moscowDateTime } from "./moscow-time";

describe("moscow-time", () => {
  it("moscowDate берёт сутки по Москве, а не по UTC", () => {
    // 22:30 UTC — уже 01:30 следующего дня в Москве.
    expect(moscowDate(new Date("2026-11-19T22:30:00Z"))).toBe("2026-11-20");
    expect(moscowDate(new Date("2026-11-19T20:59:00Z"))).toBe("2026-11-19");
  });

  it("mondayOf возвращает понедельник той же недели", () => {
    expect(mondayOf("2026-11-16")).toBe("2026-11-16");
    expect(mondayOf("2026-11-21")).toBe("2026-11-16");
    expect(mondayOf("2026-11-22")).toBe("2026-11-16");
    expect(mondayOf("2026-12-02")).toBe("2026-11-30");
  });

  it("addDays переходит через месяц и год", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDays("2026-11-19", 0)).toBe("2026-11-19");
  });

  it("moscowDateTime переводит московское время в UTC", () => {
    expect(moscowDateTime("2026-11-19", "09:00").toISOString()).toBe("2026-11-19T06:00:00.000Z");
    expect(moscowDateTime("2026-11-20", "01:30").toISOString()).toBe("2026-11-19T22:30:00.000Z");
  });
});
