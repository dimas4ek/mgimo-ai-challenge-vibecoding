import type { Lesson } from "@aihs/contract";
import { describe, expect, it } from "vitest";
import {
  addDays,
  formatDayTitle,
  formatWeekRange,
  groupByDay,
  isOngoing,
  lessonsOn,
  mondayOf,
  moscowTime,
  moscowToday,
  nextLesson,
} from "./model";

const lesson = (over: Partial<Lesson>): Lesson => ({
  id: crypto.randomUUID(),
  date: "2026-11-19",
  start: "09:00",
  end: "10:30",
  subject: "Машинное обучение",
  type: "lecture",
  room: "А-214",
  teacher: "Зарецкий Илья Павлович",
  change: null,
  ...over,
});

/** Момент по Москве: Москва — UTC+3 без перехода на летнее время. */
const msk = (date: string, time: string) => new Date(`${date}T${time}:00+03:00`);

describe("даты по Москве", () => {
  it("дата и время берутся по Москве, а не по UTC", () => {
    // 22:30 UTC 18.11 — это уже 01:30 19.11 в Москве.
    const now = new Date("2026-11-18T22:30:00Z");
    expect(moscowToday(now)).toBe("2026-11-19");
    expect(moscowTime(now)).toBe("01:30");
  });

  it("addDays переходит через месяц и год", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-28", 7)).toBe("2027-01-04");
    expect(addDays("2026-11-16", -7)).toBe("2026-11-09");
  });

  it("mondayOf: понедельник той же недели, воскресенье — конец недели", () => {
    expect(mondayOf("2026-11-19")).toBe("2026-11-16");
    expect(mondayOf("2026-11-16")).toBe("2026-11-16");
    expect(mondayOf("2026-11-22")).toBe("2026-11-16");
  });

  it("подписи дня и недели на русском", () => {
    expect(formatDayTitle("2026-11-16")).toBe("Понедельник, 16 ноября");
    expect(formatWeekRange("2026-11-16", "2026-11-22")).toBe("16–22 ноября");
    expect(formatWeekRange("2026-11-30", "2026-12-06")).toBe("30 ноября – 6 декабря");
  });
});

describe("пары", () => {
  const week = [
    lesson({ date: "2026-11-20", start: "09:00", end: "10:30", subject: "Пятница" }),
    lesson({ date: "2026-11-19", start: "12:40", end: "14:10", subject: "Третья" }),
    lesson({ date: "2026-11-19", start: "09:00", end: "10:30", subject: "Первая" }),
    lesson({
      date: "2026-11-19",
      start: "10:45",
      end: "12:15",
      subject: "Отменённая",
      change: { kind: "cancelled", note: "Болезнь", originalDate: null, originalStart: null },
    }),
  ];

  it("lessonsOn: пары дня по времени, отменённые на месте", () => {
    expect(lessonsOn(week, "2026-11-19").map((l) => l.subject)).toEqual([
      "Первая",
      "Отменённая",
      "Третья",
    ]);
    expect(lessonsOn(week, "2026-11-21")).toEqual([]);
  });

  it("groupByDay: дни по порядку, пустые дни пропущены", () => {
    expect(groupByDay(week).map((d) => [d.date, d.lessons.length])).toEqual([
      ["2026-11-19", 3],
      ["2026-11-20", 1],
    ]);
  });

  it("nextLesson: идущая сейчас пара считается ближайшей", () => {
    expect(nextLesson(week, msk("2026-11-19", "09:30"))?.subject).toBe("Первая");
  });

  it("nextLesson: отменённую пропускает", () => {
    expect(nextLesson(week, msk("2026-11-19", "10:40"))?.subject).toBe("Третья");
  });

  it("nextLesson: после последней пары дня — завтрашняя, после конца недели — null", () => {
    expect(nextLesson(week, msk("2026-11-19", "14:10"))?.subject).toBe("Пятница");
    expect(nextLesson(week, msk("2026-11-20", "11:00"))).toBeNull();
  });

  it("isOngoing: только сегодня, внутри интервала, не отменённая", () => {
    const [first] = lessonsOn(week, "2026-11-19");
    if (!first) throw new Error("нет пары");
    expect(isOngoing(first, msk("2026-11-19", "09:00"))).toBe(true);
    expect(isOngoing(first, msk("2026-11-19", "10:30"))).toBe(false);
    expect(isOngoing(first, msk("2026-11-20", "09:30"))).toBe(false);
    const cancelled = week.find((l) => l.change?.kind === "cancelled");
    if (!cancelled) throw new Error("нет отменённой");
    expect(isOngoing(cancelled, msk("2026-11-19", "11:00"))).toBe(false);
  });
});
