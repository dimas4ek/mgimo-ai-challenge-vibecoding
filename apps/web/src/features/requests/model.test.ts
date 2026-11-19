import {
  REQUEST_CATEGORY,
  type RequestListItem,
  RequestStatusSchema,
  RequestTypeSchema,
} from "@aihs/contract";
import { describe, expect, it } from "vitest";
import {
  commentField,
  formatDateTime,
  requestCategoryLabel,
  requestStatusView,
  requestTypeHint,
  requestTypeLabel,
  requestTypesByCategory,
  sortRequests,
  timeline,
  validateComment,
} from "./model";

const item = (over: Partial<RequestListItem>): RequestListItem => ({
  id: crypto.randomUUID(),
  type: "enrollment_certificate",
  status: "submitted",
  comment: null,
  createdAt: "2026-11-10T09:00:00.000Z",
  updatedAt: "2026-11-10T09:00:00.000Z",
  ...over,
});

describe("подписи", () => {
  it("у каждого типа есть подпись и пояснение, у каждого статуса — подпись", () => {
    for (const type of RequestTypeSchema.options) {
      expect(requestTypeLabel(type)).not.toBe("");
      expect(requestTypeHint(type)).not.toBe("");
    }
    for (const status of RequestStatusSchema.options) {
      expect(requestStatusView(status).label).not.toBe("");
    }
    expect(requestTypeLabel("retake_application")).toBe("Заявление на пересдачу");
    expect(requestStatusView("in_review")).toEqual({ label: "На рассмотрении", tone: "info" });
    expect(requestStatusView("rejected").tone).toBe("danger");
    expect(requestCategoryLabel("certificate")).toBe("Справки");
  });

  it("группы мастера: сначала справки, потом заявления, все типы ровно по разу", () => {
    const groups = requestTypesByCategory();
    expect(groups.map((g) => g.category)).toEqual(["certificate", "application"]);
    const all = groups.flatMap((g) => g.types);
    expect([...all].sort()).toEqual([...RequestTypeSchema.options].sort());
    for (const g of groups) for (const t of g.types) expect(REQUEST_CATEGORY[t]).toBe(g.category);
  });
});

describe("пояснение", () => {
  it("для заявлений обязательно, для справок нет", () => {
    expect(commentField("retake_application").required).toBe(true);
    expect(commentField("transcript").required).toBe(false);
    expect(validateComment("retake_application", "   ")).toMatch(/Опишите/);
    expect(validateComment("transcript", "")).toBeNull();
    expect(validateComment("retake_application", "Матанализ")).toBeNull();
  });

  it("не длиннее 1000 символов после обрезки пробелов", () => {
    expect(validateComment("transcript", "а".repeat(1000))).toBeNull();
    expect(validateComment("transcript", ` ${"а".repeat(1000)} `)).toBeNull();
    expect(validateComment("transcript", "а".repeat(1001))).toBe("Не больше 1000 символов");
  });
});

describe("порядок", () => {
  it("активные сверху, внутри групп — свежие по updatedAt", () => {
    const oldReady = item({ status: "ready", updatedAt: "2026-11-01T10:00:00.000Z" });
    const newReady = item({ status: "ready", updatedAt: "2026-11-19T10:00:00.000Z" });
    const oldActive = item({ status: "in_review", updatedAt: "2026-11-05T10:00:00.000Z" });
    const newActive = item({ status: "submitted", updatedAt: "2026-11-18T10:00:00.000Z" });
    const rejected = item({ status: "rejected", updatedAt: "2026-11-20T10:00:00.000Z" });
    const input = [oldReady, rejected, oldActive, newReady, newActive];
    expect(sortRequests(input)).toEqual([newActive, oldActive, rejected, newReady, oldReady]);
    expect(input[0]).toBe(oldReady); // исходный массив не трогаем
  });

  it("таймлайн — по времени, старые сверху", () => {
    const history = [
      { status: "ready" as const, at: "2026-11-13T11:40:00.000Z", comment: "Готово" },
      { status: "submitted" as const, at: "2026-11-12T08:15:00.000Z", comment: null },
      { status: "in_review" as const, at: "2026-11-12T13:02:00.000Z", comment: null },
    ];
    expect(timeline(history).map((h) => h.status)).toEqual(["submitted", "in_review", "ready"]);
  });
});

describe("formatDateTime", () => {
  const now = new Date("2026-11-20T12:00:00+03:00");

  it("по Москве, без года в текущем году", () => {
    // 08:15 UTC = 11:15 МСК
    expect(formatDateTime("2026-11-12T08:15:00.000Z", now)).toBe("12 ноября, 11:15");
    // 22:30 UTC 31 декабря = 01:30 МСК 1 января следующего года
    expect(formatDateTime("2025-12-31T22:30:00.000Z", now)).toBe("1 января, 01:30");
  });

  it("с годом, если год другой", () => {
    expect(formatDateTime("2025-11-12T08:15:00.000Z", now)).toBe("12 ноября 2025 г., 11:15");
  });
});
