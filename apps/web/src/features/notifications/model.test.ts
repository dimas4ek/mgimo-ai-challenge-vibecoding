import { type Notification, NotificationTypeSchema } from "@aihs/contract";
import { describe, expect, it } from "vitest";
import { badgeText, formatTime, groupByDay, notificationTypeView, unreadLabel } from "./model";

const note = (createdAt: string, over: Partial<Notification> = {}): Notification => ({
  id: crypto.randomUUID(),
  type: "news",
  title: "Новость",
  body: "",
  createdAt,
  read: false,
  link: null,
  ...over,
});

/** Момент по Москве: Москва — UTC+3 без перехода на летнее время. */
const msk = (date: string, time: string) => `${date}T${time}:00+03:00`;
const now = new Date(msk("2026-11-20", "12:00"));

describe("notificationTypeView", () => {
  it("у каждого типа своя подпись", () => {
    const labels = NotificationTypeSchema.options.map((t) => notificationTypeView(t).label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(notificationTypeView("schedule_change")).toEqual({ label: "Расписание", tone: "info" });
  });
});

describe("groupByDay", () => {
  it("«Сегодня», «Вчера», дата; день — по Москве, новые сверху", () => {
    const a = note(msk("2026-11-20", "00:30")); // 21:30 UTC 19.11 — но по Москве уже сегодня
    const b = note(msk("2026-11-20", "09:00"));
    const c = note(msk("2026-11-19", "23:50"));
    const d = note(msk("2026-11-12", "10:00"));
    const groups = groupByDay([d, a, c, b], now);
    expect(groups.map((g) => g.title)).toEqual(["Сегодня", "Вчера", "12 ноября"]);
    expect(groups[0]?.items).toEqual([b, a]);
  });

  it("другой год — с годом; вчера через границу месяца", () => {
    const groups = groupByDay(
      [note(msk("2025-11-30", "10:00")), note(msk("2026-11-30", "10:00"))],
      new Date(msk("2026-12-01", "08:00")),
    );
    expect(groups.map((g) => g.title)).toEqual(["Вчера", "30 ноября 2025 г."]);
  });

  it("пустой список — пустые группы", () => {
    expect(groupByDay([], now)).toEqual([]);
  });
});

describe("formatTime", () => {
  it("относительное время до 6 часов, дальше часы по Москве", () => {
    expect(formatTime("2026-11-20T11:59:40+03:00", now)).toBe("только что");
    expect(formatTime(msk("2026-11-20", "11:59"), now)).toBe("1 мин назад");
    expect(formatTime(msk("2026-11-20", "11:55"), now)).toBe("5 мин назад");
    expect(formatTime(msk("2026-11-20", "09:30"), now)).toBe("2 ч назад");
    expect(formatTime(msk("2026-11-20", "05:59"), now)).toBe("05:59");
    expect(formatTime("2026-11-19T07:05:00.000Z", now)).toBe("10:05");
  });
});

describe("бейдж", () => {
  it("0 — без бейджа, до 9 — число, дальше «9+»", () => {
    expect(badgeText(0)).toBeNull();
    expect(badgeText(3)).toBe("3");
    expect(badgeText(9)).toBe("9");
    expect(badgeText(10)).toBe("9+");
  });

  it("подпись непрочитанных склоняется", () => {
    expect(unreadLabel(0)).toBe("Всё прочитано");
    expect(unreadLabel(1)).toBe("1 непрочитанное");
    expect(unreadLabel(2)).toBe("2 непрочитанных");
    expect(unreadLabel(11)).toBe("11 непрочитанных");
    expect(unreadLabel(21)).toBe("21 непрочитанное");
  });
});
