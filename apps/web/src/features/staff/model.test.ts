import { RequestStatusSchema, type StaffRequestItem } from "@aihs/contract";
import { describe, expect, it } from "vitest";
import {
  nextStatuses,
  parseStaffFilter,
  sortQueue,
  staffFilterOptions,
  statusActionLabel,
  validateStaffComment,
} from "./model";

const item = (over: Partial<StaffRequestItem>): StaffRequestItem => ({
  id: crypto.randomUUID(),
  type: "enrollment_certificate",
  status: "submitted",
  comment: null,
  createdAt: "2026-11-10T09:00:00.000Z",
  updatedAt: "2026-11-10T09:00:00.000Z",
  history: [{ status: "submitted", at: "2026-11-10T09:00:00.000Z", comment: null }],
  student: { fullName: "Студентова Анна Петровна", group: "ПИИ-301" },
  ...over,
});

describe("фильтр", () => {
  it("все статусы плюс «Все», новые первыми", () => {
    const values = staffFilterOptions().map((o) => o.value);
    expect(values[0]).toBe("submitted");
    expect([...values].sort()).toEqual([...RequestStatusSchema.options, "all"].sort());
  });

  it("из адреса: известный статус или «all», иначе — новые", () => {
    expect(parseStaffFilter("in_review")).toBe("in_review");
    expect(parseStaffFilter("all")).toBe("all");
    expect(parseStaffFilter(null)).toBe("submitted");
    expect(parseStaffFilter("hacked")).toBe("submitted");
  });
});

describe("переходы", () => {
  it("вперёд по жизненному циклу; финальные — без переходов; в «Подана» вернуть нельзя", () => {
    expect(nextStatuses("submitted")).toEqual(["in_review", "ready", "rejected"]);
    expect(nextStatuses("in_review")).toEqual(["ready", "rejected"]);
    expect(nextStatuses("ready")).toEqual([]);
    expect(nextStatuses("rejected")).toEqual([]);
    expect(statusActionLabel("in_review")).toBe("Взять в работу");
  });

  it("отказ без причины нельзя; лимит 1000 символов", () => {
    expect(validateStaffComment("rejected", "  ")).toMatch(/причину/);
    expect(validateStaffComment("rejected", "Нет оснований")).toBeNull();
    expect(validateStaffComment("ready", "")).toBeNull();
    expect(validateStaffComment("ready", "а".repeat(1001))).toBe("Не больше 1000 символов");
  });
});

describe("sortQueue", () => {
  it("активные — старые сверху, затем финальные — свежие сверху", () => {
    const newSubmitted = item({ createdAt: "2026-11-19T09:00:00.000Z" });
    const oldInReview = item({ status: "in_review", createdAt: "2026-11-01T09:00:00.000Z" });
    const oldReady = item({ status: "ready", updatedAt: "2026-11-02T09:00:00.000Z" });
    const newRejected = item({ status: "rejected", updatedAt: "2026-11-18T09:00:00.000Z" });
    expect(sortQueue([oldReady, newSubmitted, newRejected, oldInReview])).toEqual([
      oldInReview,
      newSubmitted,
      newRejected,
      oldReady,
    ]);
  });
});
