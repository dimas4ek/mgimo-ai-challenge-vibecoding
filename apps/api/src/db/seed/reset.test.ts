import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type DbHandle } from "../client";
import * as schema from "../schema";
import { seed, seedAccounts } from "./index";
import { resetStudentData } from "./reset";
import { getSeededAt } from "./seeded-at";

// Засеяли в пятницу 20.11 (12:00 МСК), сброс — в среду следующей недели 25.11.
const SEEDED = new Date("2026-11-20T09:00:00Z");
const LATER = new Date("2026-11-25T09:00:00Z");
let handle: DbHandle;
let studentId = "";
let userId = "";
let groupId = "";

beforeAll(async () => {
  handle = await createDb({ url: "" });
  await handle.migrate();
  await seed(handle.db, { now: SEEDED });
  const [row] = await handle.db
    .select({
      id: schema.students.id,
      userId: schema.students.userId,
      group: schema.students.groupId,
    })
    .from(schema.students)
    .innerJoin(schema.users, eq(schema.users.id, schema.students.userId))
    .where(eq(schema.users.login, seedAccounts.student.login));
  studentId = row?.id ?? "";
  userId = row?.userId ?? "";
  groupId = row?.group ?? "";
});

afterAll(async () => {
  await handle.close();
});

/** Пояснения изменений в расписании группы студента, как они лежат в базе. */
const changeNotes = async () =>
  (
    await handle.db
      .select({ note: schema.lessonChanges.note })
      .from(schema.lessonChanges)
      .innerJoin(schema.lessons, eq(schema.lessons.id, schema.lessonChanges.lessonId))
      .where(eq(schema.lessons.groupId, groupId))
  )
    .map((r) => r.note)
    .sort();

const scheduleNotifications = () =>
  handle.db
    .select({ body: schema.notifications.body })
    .from(schema.notifications)
    .where(
      and(
        eq(schema.notifications.userId, userId),
        eq(schema.notifications.type, "schedule_change"),
      ),
    );

describe("seededAt", () => {
  it("сид сохраняет момент засева, повторный сид его обновляет", async () => {
    expect(await getSeededAt(handle.db)).toEqual(SEEDED);
    await seed(handle.db, { now: SEEDED });
    expect(await getSeededAt(handle.db)).toEqual(SEEDED);
    const [{ n } = { n: 0 }] = await handle.db
      .select({ n: schema.seedMeta.id })
      .from(schema.seedMeta);
    expect(n).toBe(1);
  });
});

describe("resetStudentData через неделю после засева", () => {
  it("уведомления об изменениях совпадают с расписанием в базе; даты заявок не позже now", async () => {
    const notes = await changeNotes();
    expect(notes.length).toBeGreaterThan(0);

    expect(await resetStudentData(handle.db, studentId, LATER)).toBe(true);

    const bodies = (await scheduleNotifications()).map((n) => n.body);
    // Число и пояснения совпадают: в тексте каждого уведомления — `note` своего изменения
    // (у переноса — в начале, у замены и отмены — после даты и времени).
    expect(bodies).toHaveLength(notes.length);
    for (const note of notes) {
      expect(
        bodies.some((b) => b.includes(note)),
        `нет уведомления для «${note}»`,
      ).toBe(true);
    }

    const requests = await handle.db
      .select({ createdAt: schema.requests.createdAt, updatedAt: schema.requests.updatedAt })
      .from(schema.requests)
      .where(eq(schema.requests.studentId, studentId));
    expect(requests.length).toBeGreaterThan(0);
    for (const r of requests) {
      expect(r.createdAt.getTime()).toBeLessThanOrEqual(LATER.getTime());
      expect(r.updatedAt.getTime()).toBeLessThanOrEqual(LATER.getTime());
    }
  });

  it("старая база без отметки засева — сброс от now, как раньше", async () => {
    await handle.db.delete(schema.seedMeta);
    expect(await getSeededAt(handle.db)).toBeNull();
    expect(await resetStudentData(handle.db, studentId, LATER)).toBe(true);
    const requests = await handle.db
      .select({ createdAt: schema.requests.createdAt })
      .from(schema.requests)
      .where(eq(schema.requests.studentId, studentId));
    expect(requests.every((r) => r.createdAt.getTime() <= LATER.getTime())).toBe(true);
  });
});
