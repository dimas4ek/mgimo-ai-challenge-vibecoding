import { type DisciplineGrade, fixtures, GradesSchema, routes } from "@aihs/contract";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { createDb, type DbHandle } from "../../db/client";
import { seed, seedAccounts } from "../../db/seed";
import { addDays, mondayOf, moscowDate } from "../../lib/moscow-time";
import { summarize } from "./service";

const NOW = new Date("2026-11-19T09:00:00Z");
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

const get = (who: keyof typeof cookies | null) =>
  app.request(routes.me.grades.path, { headers: who ? { cookie: cookies[who] } : {} });

const grades = async (who: keyof typeof cookies) => {
  const res = await get(who);
  expect(res.status).toBe(200);
  return GradesSchema.parse(await res.json());
};

const discipline = (over: Partial<DisciplineGrade>): DisciplineGrade => ({
  id: "00000000-0000-4000-8000-000000000000",
  subject: "Предмет",
  teacher: "Преподаватель",
  controlForm: "exam",
  credits: 3,
  semesterPoints: 40,
  examPoints: null,
  totalPoints: 40,
  result: "pending",
  exam: null,
  ...over,
});

describe("summarize", () => {
  it("совпадает со сводкой фикстуры контракта", () => {
    expect(summarize(fixtures.grades.disciplines, fixtures.grades.pastDebts)).toEqual(
      fixtures.grades.summary,
    );
  });

  it("pending не закрыт и не долг, failed — долг, среднее округляется до сотых", () => {
    const s = summarize([
      discipline({ totalPoints: 50, result: "pending" }),
      discipline({ totalPoints: 61, result: "passed", controlForm: "credit" }),
      discipline({ totalPoints: 30, result: "failed", controlForm: "credit" }),
    ]);
    expect(s).toEqual({ averagePoints: 47, disciplinesTotal: 3, disciplinesPassed: 1, debts: 1 });
    expect(
      summarize([
        discipline({ totalPoints: 1 }),
        discipline({ totalPoints: 2 }),
        discipline({ totalPoints: 2 }),
      ]).averagePoints,
    ).toBe(1.67);
  });

  it("без дисциплин — нули", () => {
    expect(summarize([])).toEqual({
      averagePoints: 0,
      disciplinesTotal: 0,
      disciplinesPassed: 0,
      debts: 0,
    });
  });
});

describe("GET /api/me/grades", () => {
  it("текущий семестр с сессией; итог = семестр + экзамен; сводка сходится", async () => {
    const g = await grades("student");
    expect(g.semester).toBe("Осенний семестр 2026/27");
    expect(g.session).toEqual({ startDate: "2026-12-28", endDate: "2027-01-24" });
    expect(g.disciplines.length).toBeGreaterThan(0);
    for (const d of g.disciplines) {
      expect(d.totalPoints).toBe(d.semesterPoints + (d.examPoints ?? 0));
    }
    expect(g.summary).toEqual(summarize(g.disciplines, g.pastDebts));
  });

  it("только свои: у двух студентов разные записи", async () => {
    const mine = new Set((await grades("student")).disciplines.map((d) => d.id));
    const theirs = (await grades("student2")).disciplines.map((d) => d.id);
    expect(theirs.length).toBeGreaterThan(0);
    expect(theirs.some((id) => mine.has(id))).toBe(false);
  });

  it("даты экзаменов: экзамен внутри сессии, зачёт до неё, без воскресений", async () => {
    for (const who of ["student", "student2"] as const) {
      const g = await grades(who);
      const { startDate, endDate } = g.session ?? { startDate: "", endDate: "" };
      const scheduled = g.disciplines.filter((d) => d.exam !== null);
      expect(scheduled.length).toBeGreaterThan(0);
      for (const d of scheduled) {
        const date = d.exam?.date ?? "";
        if (d.controlForm === "exam") {
          expect(date >= startDate && date <= endDate, `${d.subject}: ${date}`).toBe(true);
        } else {
          expect(date < startDate, `${d.subject}: ${date}`).toBe(true);
        }
        expect(addDays(mondayOf(date), 6)).not.toBe(date);
        expect(d.exam?.start).toMatch(/^\d{2}:\d{2}$/);
      }
    }
    // Демо пустого состояния: у одной дисциплины дата ещё не назначена.
    expect((await grades("student")).disciplines.some((d) => d.exam === null)).toBe(true);
  });

  it("даты экзаменов у двух студентов разные", async () => {
    const slots = async (who: "student" | "student2") =>
      (await grades(who)).disciplines.flatMap((d) =>
        d.exam ? [`${d.exam.date} ${d.exam.start} ${d.exam.room}`] : [],
      );
    const mine = new Set(await slots("student"));
    expect((await slots("student2")).some((s) => mine.has(s))).toBe(false);
  });

  it("в текущем семестре нет баллов за экзамен или зачёт, дата которого ещё не наступила", async () => {
    const today = moscowDate(NOW);
    for (const who of ["student", "student2"] as const) {
      for (const d of (await grades(who)).disciplines) {
        if (d.examPoints === null) continue;
        expect(d.exam, d.subject).not.toBeNull();
        expect(d.exam?.date ?? "", d.subject).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect((d.exam?.date ?? "") <= today, `${d.subject}: ${d.exam?.date}`).toBe(true);
      }
    }
  });

  it("долг прошлой сессии: у student один, в сводке учтён, в текущем семестре долгов нет", async () => {
    const g = await grades("student");
    expect(g.pastDebts).toHaveLength(1);
    expect(g.pastDebts[0]).toMatchObject({
      semester: "Весенний семестр 2025/26",
      subject: "Теория вероятностей и статистика, ч. 1",
      result: "unsatisfactory",
    });
    expect(g.pastDebts[0]?.totalPoints).toBe(
      (g.pastDebts[0]?.semesterPoints ?? 0) + (g.pastDebts[0]?.examPoints ?? 0),
    );
    // Сданная дисциплина прошлого семестра в долги не попадает.
    expect(g.pastDebts.map((d) => d.subject)).not.toContain("Философия науки");
    expect(g.summary.debts).toBe(1);
    expect(g.summary).toEqual(summarize(g.disciplines, g.pastDebts));
    const part2 = g.disciplines.find((d) => d.subject === "Теория вероятностей и статистика, ч. 2");
    expect(part2).toMatchObject({ examPoints: null, result: "pending" });
  });

  it("у student2 прошлых долгов нет, а данные свои", async () => {
    const g = await grades("student2");
    expect(g.pastDebts).toEqual([]);
    expect(g.summary.debts).toBe(0);
  });

  it("сброс демо-данных не меняет успеваемость", async () => {
    const before = await grades("student");
    const res = await app.request(routes.me.demoReset.path, {
      method: "POST",
      headers: { cookie: cookies.student },
    });
    expect(res.status).toBe(200);
    expect(await grades("student")).toEqual(before);
  });

  it("без сессии → 401, сотруднику → 403", async () => {
    expect((await get(null)).status).toBe(401);
    expect((await get("staff")).status).toBe(403);
  });
});
