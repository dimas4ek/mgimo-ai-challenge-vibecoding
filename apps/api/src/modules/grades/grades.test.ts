import { type DisciplineGrade, fixtures, GradesSchema, routes } from "@aihs/contract";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { createDb, type DbHandle } from "../../db/client";
import { seed, seedAccounts } from "../../db/seed";
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
    expect(summarize(fixtures.grades.disciplines)).toEqual(fixtures.grades.summary);
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
    expect(g.summary).toEqual(summarize(g.disciplines));
  });

  it("только свои: у двух студентов разные записи", async () => {
    const mine = new Set((await grades("student")).disciplines.map((d) => d.id));
    const theirs = (await grades("student2")).disciplines.map((d) => d.id);
    expect(theirs.length).toBeGreaterThan(0);
    expect(theirs.some((id) => mine.has(id))).toBe(false);
  });

  it("без сессии → 401, сотруднику → 403", async () => {
    expect((await get(null)).status).toBe(401);
    expect((await get("staff")).status).toBe(403);
  });
});
