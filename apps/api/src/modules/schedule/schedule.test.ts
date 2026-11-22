import {
  ApiErrorSchema,
  MyGroupSchema,
  ProfileSchema,
  routes,
  type WeekSchedule,
  WeekScheduleSchema,
} from "@aihs/contract";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { createDb, type DbHandle } from "../../db/client";
import { seed, seedAccounts } from "../../db/seed";
import { addDays, mondayOf, moscowDate } from "../../lib/moscow-time";

// Четверг: неделя пн 16.11 – вс 22.11 по Москве.
const NOW = new Date("2026-11-19T09:00:00Z");
const MONDAY = mondayOf(moscowDate(NOW));
let handle: DbHandle;
let app: ReturnType<typeof createApp>;
const cookies: Record<keyof typeof seedAccounts, string> = { student: "", student2: "", staff: "" };

beforeAll(async () => {
  handle = await createDb({ url: "" });
  await handle.migrate();
  await seed(handle.db, { now: NOW });
  app = createApp({ db: handle.db, now: () => NOW });
  for (const who of Object.keys(seedAccounts) as (keyof typeof seedAccounts)[]) {
    const res = await app.request(routes.auth.login.path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(seedAccounts[who]),
    });
    expect(res.status).toBe(200);
    cookies[who] = (res.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
  }
});

afterAll(async () => {
  await handle.close();
});

const get = (path: string, who: keyof typeof cookies | null) =>
  app.request(path, { headers: who ? { cookie: cookies[who] } : {} });

const schedule = async (who: keyof typeof cookies, week?: string) => {
  const path = week ? `${routes.me.schedule.path}?week=${week}` : routes.me.schedule.path;
  const res = await get(path, who);
  expect(res.status).toBe(200);
  return WeekScheduleSchema.parse(await res.json());
};

/** Состав базовой недели без календарных дат и разовых переносов. */
const baseSlots = (week: WeekSchedule) =>
  week.lessons
    .map((lesson) => {
      const date = lesson.change?.originalDate ?? lesson.date;
      const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
      return `${weekday} ${lesson.change?.originalStart ?? lesson.start} ${lesson.subject}`;
    })
    .sort();

describe("GET /api/me/profile", () => {
  it("профиль своего студента; у двух студентов разные", async () => {
    const res = await get(routes.me.profile.path, "student");
    expect(res.status).toBe(200);
    const mine = ProfileSchema.parse(await res.json());
    expect(mine.lastName).toBe("Лебедянская");
    const theirs = ProfileSchema.parse(
      await (await get(routes.me.profile.path, "student2")).json(),
    );
    expect(theirs.recordBookNumber).not.toBe(mine.recordBookNumber);
    expect(theirs.group).not.toBe(mine.group);
  });

  it("без сессии → 401, сотруднику → 403", async () => {
    expect((await get(routes.me.profile.path, null)).status).toBe(401);
    expect((await get(routes.me.profile.path, "staff")).status).toBe(403);
  });
});

describe("GET /api/me/group", () => {
  it("возвращает только свою группу и имена её участников", async () => {
    const mine = await get(`${routes.me.group.path}?group=АД-201`, "student");
    const theirs = await get(routes.me.group.path, "student2");
    expect(mine.status).toBe(200);
    expect(theirs.status).toBe(200);
    expect(MyGroupSchema.parse(await mine.json())).toMatchObject({
      name: "ПИИ-301",
      members: ["Лебедянская Мирослава Игоревна"],
      announcements: [expect.any(String)],
    });
    expect(MyGroupSchema.parse(await theirs.json())).toMatchObject({
      name: "АД-201",
      members: [expect.stringContaining("Колосовский")],
      announcements: [],
    });
  });

  it("требует студенческую сессию", async () => {
    expect((await get(routes.me.group.path, null)).status).toBe(401);
    expect((await get(routes.me.group.path, "staff")).status).toBe(403);
  });
});

describe("GET /api/me/schedule", () => {
  it("без week — текущая неделя по МСК, пары внутри неё и отсортированы", async () => {
    const week = await schedule("student");
    expect(week.weekStart).toBe(MONDAY);
    expect(week.weekEnd).toBe(addDays(MONDAY, 6));
    expect(week.lessons.length).toBeGreaterThan(0);
    for (const l of week.lessons) {
      expect(l.date >= week.weekStart && l.date <= week.weekEnd).toBe(true);
    }
    const keys = week.lessons.map((l) => `${l.date} ${l.start}`);
    expect(keys).toEqual([...keys].sort());
  });

  it("перенос попадает в ответ с исходной датой и временем", async () => {
    const week = await schedule("student");
    const moved = week.lessons.find((l) => l.change?.kind === "moved");
    expect(moved).toBeDefined();
    expect(moved?.change?.originalDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(moved?.change?.originalStart).toMatch(/^\d{2}:\d{2}$/);
    expect(moved?.change?.note.length).toBeGreaterThan(0);
  });

  it("два студента из разных групп видят разные пары", async () => {
    const mine = new Set((await schedule("student")).lessons.map((l) => l.id));
    const theirs = (await schedule("student2")).lessons.map((l) => l.id);
    expect(theirs.length).toBeGreaterThan(0);
    expect(theirs.some((id) => mine.has(id))).toBe(false);
  });

  it("week — любая дата недели: та же неделя; следующая неделя другая", async () => {
    const current = await schedule("student");
    const bySunday = await schedule("student", addDays(MONDAY, 6));
    expect(bySunday).toEqual(current);
    const next = await schedule("student", addDays(MONDAY, 9));
    expect(next.weekStart).toBe(addDays(MONDAY, 7));
    expect(next.lessons.every((l) => l.date >= next.weekStart)).toBe(true);
  });

  it.each(["student", "student2"] as const)(
    "у %s соседние недели различаются базовыми парами",
    async (who) => {
      const current = await schedule(who, MONDAY);
      const next = await schedule(who, addDays(MONDAY, 7));
      expect(current.lessons.length).toBeGreaterThan(0);
      expect(next.lessons.length).toBeGreaterThan(0);
      expect(baseSlots(current)).not.toEqual(baseSlots(next));
      for (const week of [current, next]) {
        const slots = new Set(week.lessons.map((lesson) => `${lesson.date} ${lesson.start}`));
        expect(slots.size).toBe(week.lessons.length);
      }
    },
  );

  it.each(["19.11.2026", "9999-12-27", "1899-01-02"])(
    "невалидный week (%s) → 400 validation",
    async (week) => {
      const res = await get(`${routes.me.schedule.path}?week=${week}`, "student");
      expect(res.status).toBe(400);
      expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("validation");
    },
  );

  it("без сессии → 401, сотруднику → 403", async () => {
    expect((await get(routes.me.schedule.path, null)).status).toBe(401);
    expect((await get(routes.me.schedule.path, "staff")).status).toBe(403);
  });
});
