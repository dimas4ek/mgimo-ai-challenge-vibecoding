import { verify } from "@node-rs/argon2";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db, type DbHandle } from "../client";
import * as schema from "../schema";
import { seed, seedAccounts } from "./index";

// Четверг 19.11.2026, 12:00 по Москве. Текущая неделя — 16–22.11.
const NOW = new Date("2026-11-19T09:00:00Z");

/** Все таблицы целиком, отсортированные по ключу: для сравнения «до» и «после». */
async function snapshot(db: Db) {
  return {
    users: await db.select().from(schema.users).orderBy(asc(schema.users.id)),
    sessions: await db.select().from(schema.sessions).orderBy(asc(schema.sessions.tokenHash)),
    faculties: await db.select().from(schema.faculties).orderBy(asc(schema.faculties.id)),
    groups: await db.select().from(schema.groups).orderBy(asc(schema.groups.id)),
    students: await db.select().from(schema.students).orderBy(asc(schema.students.id)),
    teachers: await db.select().from(schema.teachers).orderBy(asc(schema.teachers.id)),
    subjects: await db.select().from(schema.subjects).orderBy(asc(schema.subjects.id)),
    lessons: await db.select().from(schema.lessons).orderBy(asc(schema.lessons.id)),
    lessonChanges: await db
      .select()
      .from(schema.lessonChanges)
      .orderBy(asc(schema.lessonChanges.lessonId)),
    semesters: await db.select().from(schema.semesters).orderBy(asc(schema.semesters.id)),
    grades: await db.select().from(schema.grades).orderBy(asc(schema.grades.id)),
    requests: await db.select().from(schema.requests).orderBy(asc(schema.requests.id)),
    requestHistory: await db
      .select()
      .from(schema.requestHistory)
      .orderBy(asc(schema.requestHistory.id)),
    notifications: await db
      .select()
      .from(schema.notifications)
      .orderBy(asc(schema.notifications.id)),
  };
}

async function freshDb() {
  const handle = await createDb({ url: "" });
  await handle.migrate();
  return handle;
}

describe("seed", () => {
  let handle: DbHandle;
  let db: Db;

  beforeAll(async () => {
    handle = await freshDb();
    db = handle.db;
    await seed(db, { now: NOW });
  });

  afterAll(async () => {
    await handle.close();
  });

  it("создаёт двух студентов из разных групп и одного сотрудника", async () => {
    const users = await db.select().from(schema.users);
    expect(users.map((u) => [u.login, u.role]).sort()).toEqual([
      [seedAccounts.staff.login, "staff"],
      [seedAccounts.student.login, "student"],
      [seedAccounts.student2.login, "student"],
    ]);
    const students = await db.select().from(schema.students);
    expect(students).toHaveLength(2);
    expect(new Set(students.map((s) => s.groupId)).size).toBe(2);
  });

  it("хранит пароли только как argon2id-хеш, и они проверяются", async () => {
    const users = await db.select().from(schema.users);
    for (const u of users) {
      const account = Object.values(seedAccounts).find((a) => a.login === u.login);
      expect(u.passwordHash.startsWith("$argon2id$")).toBe(true);
      expect(u.passwordHash).not.toContain(account?.password);
      expect(await verify(u.passwordHash, account?.password ?? "")).toBe(true);
    }
  });

  it("у каждой группы есть пары на текущей неделе, в том числе в субботу", async () => {
    const groups = await db.select().from(schema.groups);
    for (const g of groups) {
      const week = await db
        .select()
        .from(schema.lessons)
        .where(
          and(
            eq(schema.lessons.groupId, g.id),
            gte(schema.lessons.date, "2026-11-16"),
            lte(schema.lessons.date, "2026-11-22"),
          ),
        );
      expect(week.length).toBeGreaterThan(5);
      expect(week.some((l) => l.date === "2026-11-21")).toBe(true);
    }
  });

  it("на текущей неделе есть перенос, замена и отмена", async () => {
    const changes = await db
      .select({ kind: schema.lessonChanges.kind, date: schema.lessons.date })
      .from(schema.lessonChanges)
      .innerJoin(schema.lessons, eq(schema.lessons.id, schema.lessonChanges.lessonId))
      .where(and(gte(schema.lessons.date, "2026-11-16"), lte(schema.lessons.date, "2026-11-22")));
    expect(new Set(changes.map((c) => c.kind))).toEqual(new Set(["moved", "replaced", "cancelled"]));
    const moved = await db
      .select()
      .from(schema.lessonChanges)
      .where(eq(schema.lessonChanges.kind, "moved"));
    expect(moved.every((m) => m.originalDate && m.originalStart)).toBe(true);
  });

  it("заполняет оценки, текущий семестр и сессию, данные у студентов разные", async () => {
    const [semester] = await db.select().from(schema.semesters);
    expect(semester).toMatchObject({
      name: "Осенний семестр 2026/27",
      sessionStart: "2026-12-28",
      sessionEnd: "2027-01-24",
      isCurrent: true,
    });
    const students = await db.select().from(schema.students);
    const subjectSets = await Promise.all(
      students.map(async (s) => {
        const rows = await db.select().from(schema.grades).where(eq(schema.grades.studentId, s.id));
        expect(rows.length).toBeGreaterThan(0);
        return rows.map((r) => r.subjectId).sort();
      }),
    );
    expect(subjectSets[0]).not.toEqual(subjectSets[1]);
    const results = (await db.select().from(schema.grades)).map((g) => g.result);
    expect(results).toContain("pending");
  });

  it("у заявок история начинается с submitted и кончается текущим статусом", async () => {
    const requests = await db.select().from(schema.requests);
    expect(new Set(requests.map((r) => r.status))).toEqual(
      new Set(["submitted", "in_review", "ready", "rejected"]),
    );
    for (const r of requests) {
      const history = await db
        .select()
        .from(schema.requestHistory)
        .where(eq(schema.requestHistory.requestId, r.id))
        .orderBy(asc(schema.requestHistory.at));
      expect(history[0]?.status).toBe("submitted");
      expect(history.at(-1)?.status).toBe(r.status);
      expect(r.createdAt.getTime()).toBeLessThanOrEqual(NOW.getTime());
    }
  });

  it("повторный сид даёт то же состояние и стирает созданное руками", async () => {
    const before = await snapshot(db);
    const [student] = await db.select().from(schema.students);
    await db.insert(schema.requests).values({ studentId: student?.id ?? "", type: "transcript" });
    await seed(db, { now: NOW });
    expect(await snapshot(db)).toEqual(before);
  });
});

describe("seed от другой даты", () => {
  it("строит пары от недели переданного now и весенний семестр", async () => {
    const handle = await freshDb();
    // Среда 10.03.2027 → неделя 08–14.03.
    await seed(handle.db, { now: new Date("2027-03-10T10:00:00Z") });
    const week = await handle.db
      .select()
      .from(schema.lessons)
      .where(and(gte(schema.lessons.date, "2027-03-08"), lte(schema.lessons.date, "2027-03-14")));
    expect(week.length).toBeGreaterThan(10);
    const [semester] = await handle.db.select().from(schema.semesters);
    expect(semester?.name).toBe("Весенний семестр 2026/27");
    await handle.close();
  });
});
