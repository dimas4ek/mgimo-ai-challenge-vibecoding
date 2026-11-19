import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { MeSchema } from "./auth";
import { CertificateSchema, CertificateVerificationSchema } from "./certificates";
import { fixtures } from "./fixtures";
import { GradesSchema } from "./grades";
import { NotificationListSchema } from "./notifications";
import { ProfileSchema } from "./profile";
import { RequestListItemSchema, RequestSchema } from "./requests";
import { WeekScheduleSchema } from "./schedule";
import { StaffRequestItemSchema } from "./staff";

const cases: [string, z.ZodType, unknown][] = [
  ["me.student", MeSchema, fixtures.me.student],
  ["me.student2", MeSchema, fixtures.me.student2],
  ["me.staff", MeSchema, fixtures.me.staff],
  ["profile", ProfileSchema, fixtures.profile],
  ["weekSchedule", WeekScheduleSchema, fixtures.weekSchedule],
  ["grades", GradesSchema, fixtures.grades],
  ["notifications", NotificationListSchema, fixtures.notifications],
  ...fixtures.requests.map(
    (r, i) => [`requests[${i}]`, RequestListItemSchema, r] as [string, z.ZodType, unknown],
  ),
  ...Object.entries(fixtures.requestById).map(
    ([id, r]) => [`requestById.${id}`, RequestSchema, r] as [string, z.ZodType, unknown],
  ),
  ...fixtures.staffRequests.map(
    (r, i) => [`staffRequests[${i}]`, StaffRequestItemSchema, r] as [string, z.ZodType, unknown],
  ),
  ...Object.entries(fixtures.certificateByRequestId).map(
    ([id, c]) =>
      [`certificateByRequestId.${id}`, CertificateSchema, c] as [string, z.ZodType, unknown],
  ),
  ...Object.entries(fixtures.verificationByToken).map(
    ([t, v]) =>
      [`verificationByToken.${t}`, CertificateVerificationSchema, v] as [
        string,
        z.ZodType,
        unknown,
      ],
  ),
];

describe("фикстуры проходят свои схемы", () => {
  it.each(cases)("%s", (_name, schema, value) => {
    const result = schema.safeParse(value);
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
  });
});

describe("фикстуры согласованы между собой", () => {
  it("список заявок = карточки без истории, новые сверху", () => {
    const dates = fixtures.requests.map((r) => r.createdAt);
    expect(dates).toEqual([...dates].sort().reverse());
    for (const item of fixtures.requests) {
      const card = fixtures.requestById[item.id];
      if (!card) throw new Error(`нет карточки ${item.id}`);
      const { history, ...rest } = card;
      expect(rest).toEqual(item);
      expect(history[0]?.status).toBe("submitted");
      expect(history.at(-1)?.status).toBe(item.status);
    }
  });

  it("unreadCount совпадает с непрочитанными", () => {
    const unread = fixtures.notifications.items.filter((n) => !n.read).length;
    expect(fixtures.notifications.unreadCount).toBe(unread);
  });

  it("сводка успеваемости совпадает с дисциплинами", () => {
    const { disciplines, summary } = fixtures.grades;
    const avg = disciplines.reduce((s, d) => s + d.totalPoints, 0) / disciplines.length;
    expect(summary.averagePoints).toBeCloseTo(avg, 2);
    expect(summary.disciplinesTotal).toBe(disciplines.length);
    const debts = disciplines.filter((d) => d.result === "unsatisfactory" || d.result === "failed");
    expect(summary.debts).toBe(debts.length);
    const passed = disciplines.filter((d) =>
      ["excellent", "good", "satisfactory", "passed"].includes(d.result),
    );
    expect(summary.disciplinesPassed).toBe(passed.length);
    for (const d of disciplines) {
      expect(d.totalPoints).toBe(d.semesterPoints + (d.examPoints ?? 0));
    }
  });

  it("пары недели лежат внутри недели и отсортированы", () => {
    const { weekStart, weekEnd, lessons } = fixtures.weekSchedule;
    const keys = lessons.map((l) => `${l.date} ${l.start}`);
    expect(keys).toEqual([...keys].sort());
    for (const l of lessons) {
      expect(l.date >= weekStart && l.date <= weekEnd).toBe(true);
      expect(l.start < l.end).toBe(true);
    }
  });
});
