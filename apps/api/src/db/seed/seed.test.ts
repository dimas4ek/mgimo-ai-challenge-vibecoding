import { verify } from "@node-rs/argon2";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays, mondayOf } from "../../lib/moscow-time";
import { createDb, type Db, type DbHandle } from "../client";
import * as schema from "../schema";
import { buildSeedData, seedId } from "./data";
import { seed, seedAccounts } from "./index";

// Четверг 19.11.2026, 12:00 по Москве. Текущая неделя — 16–22.11.
const NOW = new Date("2026-11-19T09:00:00Z");
const demoUserIds = new Set([seedId("user:student"), seedId("user:student2")]);

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

  it("создаёт три демо-аккаунта и заполняет обе группы", async () => {
    const users = await db.select().from(schema.users);
    expect(
      users
        .filter((u) => !u.login.startsWith("roster-"))
        .map((u) => [u.login, u.role])
        .sort(),
    ).toEqual([
      [seedAccounts.staff.login, "staff"],
      [seedAccounts.student.login, "student"],
      [seedAccounts.student2.login, "student"],
    ]);
    const students = await db.select().from(schema.students);
    for (const group of ["pii301", "ad201"]) {
      expect(students.filter((s) => s.groupId === seedId(`group:${group}`))).toHaveLength(7);
    }
  });

  it("хранит пароли только как argon2id-хеш, и они проверяются", async () => {
    const users = await db.select().from(schema.users);
    for (const u of users) {
      const account = Object.values(seedAccounts).find((a) => a.login === u.login);
      expect(u.passwordHash.startsWith("$argon2id$")).toBe(true);
      if (account) expect(u.passwordHash).not.toContain(account.password);
      expect(await verify(u.passwordHash, account?.password ?? "unused-fixture-password")).toBe(
        Boolean(account),
      );
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
    expect(new Set(changes.map((c) => c.kind))).toEqual(
      new Set(["moved", "replaced", "cancelled"]),
    );
    const moved = await db
      .select()
      .from(schema.lessonChanges)
      .where(eq(schema.lessonChanges.kind, "moved"));
    expect(moved.every((m) => m.originalDate && m.originalStart)).toBe(true);
  });

  it("о каждом изменении расписания текущей и следующей недели студент получает уведомление", async () => {
    for (const s of await db.select().from(schema.students)) {
      if (!demoUserIds.has(s.userId)) continue;
      const changes = await db
        .select({
          date: schema.lessons.date,
          start: schema.lessons.start,
          note: schema.lessonChanges.note,
        })
        .from(schema.lessonChanges)
        .innerJoin(schema.lessons, eq(schema.lessons.id, schema.lessonChanges.lessonId))
        .where(
          and(
            eq(schema.lessons.groupId, s.groupId),
            gte(schema.lessons.date, "2026-11-16"),
            lte(schema.lessons.date, "2026-11-29"),
          ),
        );
      const notes = await db
        .select()
        .from(schema.notifications)
        .where(
          and(
            eq(schema.notifications.userId, s.userId),
            eq(schema.notifications.type, "schedule_change"),
          ),
        );
      expect(changes.length).toBeGreaterThanOrEqual(3);
      expect(notes).toHaveLength(changes.length);
      for (const c of changes) {
        const notification = notes.find((n) => n.body.includes(c.note));
        expect(notification?.link).toBe(`/schedule?week=${mondayOf(c.date)}`);
        const date = `${c.date.slice(8, 10)}.${c.date.slice(5, 7)}`;
        expect(notification?.body).toContain(`${date} в ${c.start}`);
      }
      for (const n of notes) {
        expect(n.link).toMatch(/^\/schedule\?week=2026-11-(16|23)$/);
        expect(n.createdAt.getTime()).toBeLessThanOrEqual(NOW.getTime());
      }
    }
  });

  it("при смене года и повторном засеве календарная неделя сохраняет базовые пары", () => {
    const monday = "2026-12-28";
    const nextMonday = addDays(monday, 7);
    const before = buildSeedData(new Date("2026-12-30T09:00:00Z"), seedAccounts);
    const after = buildSeedData(new Date("2027-01-04T09:00:00Z"), seedAccounts);

    function baseSlots(data: typeof before, groupId: string, week: string) {
      const changes = new Map(data.lessonChanges.map((change) => [change.lessonId, change]));
      const end = addDays(week, 6);
      return data.lessons
        .filter((lesson) => lesson.groupId === groupId && lesson.date >= week && lesson.date <= end)
        .map((lesson) => {
          const change = changes.get(lesson.id ?? "");
          const date = change?.originalDate ?? lesson.date;
          const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
          return `${weekday} ${change?.originalStart ?? lesson.start} ${lesson.subjectId}`;
        })
        .sort();
    }

    for (const { id } of before.groups) {
      const current = baseSlots(before, id, monday);
      const next = baseSlots(before, id, nextMonday);
      expect(current).toEqual(baseSlots(after, id, monday));
      expect(next).toEqual(baseSlots(after, id, nextMonday));
      // 2026-W53 и 2027-W01 обе нечётные. W52 и W02 используют второй шаблон.
      const even = baseSlots(before, id, addDays(monday, -7));
      expect(current).toEqual(next);
      expect(even).toEqual(baseSlots(after, id, addDays(nextMonday, 7)));
      expect(even).not.toEqual(current);
    }
  });

  it("заполняет оценки, текущий семестр и сессию, данные у студентов разные", async () => {
    const [semester] = await db
      .select()
      .from(schema.semesters)
      .where(eq(schema.semesters.isCurrent, true));
    expect(semester).toMatchObject({
      name: "Осенний семестр 2026/27",
      sessionStart: "2026-12-28",
      sessionEnd: "2027-01-24",
      isCurrent: true,
    });
    const students = await db.select().from(schema.students);
    const subjectSets = await Promise.all(
      students
        .filter((s) => demoUserIds.has(s.userId))
        .map(async (s) => {
          const rows = await db
            .select()
            .from(schema.grades)
            .where(eq(schema.grades.studentId, s.id));
          expect(rows.length).toBeGreaterThan(0);
          return rows.map((r) => r.subjectId).sort();
        }),
    );
    expect(subjectSets[0]).not.toEqual(subjectSets[1]);
    const results = (await db.select().from(schema.grades)).map((g) => g.result);
    expect(results).toContain("pending");
  });

  it("весной даты экзаменов попадают в весеннюю сессию, зачёты — до неё, прошлый семестр — весна 2025/26", () => {
    const data = buildSeedData(new Date("2027-04-15T09:00:00Z"), seedAccounts);
    const semester = data.semesters.find((s) => s.isCurrent);
    expect(semester).toMatchObject({ sessionStart: "2027-06-08", sessionEnd: "2027-06-30" });
    expect(data.semesters.find((s) => !s.isCurrent)?.name).toBe("Весенний семестр 2025/26");
    const dated = data.grades.filter((g) => g.examDate && g.semesterId === semester?.id);
    expect(dated.length).toBeGreaterThan(0);
    for (const g of dated) {
      const date = g.examDate ?? "";
      if (g.controlForm === "exam") expect(date >= "2027-06-08" && date <= "2027-06-30").toBe(true);
      else expect(date < "2027-06-08").toBe(true);
    }
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
    const [semester] = await handle.db
      .select()
      .from(schema.semesters)
      .where(eq(schema.semesters.isCurrent, true));
    expect(semester?.name).toBe("Весенний семестр 2026/27");
    await handle.close();
  });
});
