import { and, eq, gte, lte } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addDays, mondayOf, moscowDate } from "../../lib/moscow-time";
import { createDb, type DbHandle } from "../client";
import * as schema from "../schema";
import { seed, seedAccounts } from "./index";
import { refreshDemoDataIfStale, refreshSafely } from "./refresh";
import { getSeededAt } from "./seeded-at";

// Засев в пятницу 20.11; та же неделя — воскресенье 22.11 23:30 МСК; новая — понедельник 23.11 00:30 МСК.
const SEEDED = new Date("2026-11-20T09:00:00Z");
const SAME_WEEK = new Date("2026-11-22T20:30:00Z");
const NEXT_WEEK = new Date("2026-11-22T21:30:00Z");

let handle: DbHandle;

beforeEach(async () => {
  handle = await createDb({ url: "" });
  await handle.migrate();
});
afterEach(async () => {
  await handle.close();
});

const student = async () => {
  const [row] = await handle.db
    .select({
      id: schema.students.id,
      userId: schema.students.userId,
      groupId: schema.students.groupId,
    })
    .from(schema.students)
    .innerJoin(schema.users, eq(schema.users.id, schema.students.userId))
    .where(eq(schema.users.login, seedAccounts.student.login));
  if (!row) throw new Error("нет студента в сиде");
  return row;
};

/** Изменения пар группы в неделе, где лежит `at` (по Москве). */
const changesInWeekOf = async (groupId: string, at: Date) => {
  const monday = mondayOf(moscowDate(at));
  return handle.db
    .select({ kind: schema.lessonChanges.kind, note: schema.lessonChanges.note })
    .from(schema.lessonChanges)
    .innerJoin(schema.lessons, eq(schema.lessons.id, schema.lessonChanges.lessonId))
    .where(
      and(
        eq(schema.lessons.groupId, groupId),
        gte(schema.lessons.date, monday),
        lte(schema.lessons.date, addDays(monday, 6)),
      ),
    );
};

describe("refreshDemoDataIfStale", () => {
  it("пустая база — засев", { timeout: 60_000 }, async () => {
    expect(await refreshDemoDataIfStale(handle.db, SEEDED)).toBe(true);
    expect(await getSeededAt(handle.db)).toEqual(SEEDED);
    await student();
  });

  it("та же неделя — пересева нет, созданная заявка на месте", { timeout: 60_000 }, async () => {
    await seed(handle.db, { now: SEEDED });
    const { id } = await student();
    const [created] = await handle.db
      .insert(schema.requests)
      .values({ studentId: id, type: "transcript", createdAt: SEEDED, updatedAt: SEEDED })
      .returning({ id: schema.requests.id });
    expect(await refreshDemoDataIfStale(handle.db, SAME_WEEK)).toBe(false);
    const still = await handle.db
      .select({ id: schema.requests.id })
      .from(schema.requests)
      .where(eq(schema.requests.id, created?.id ?? ""));
    expect(still).toHaveLength(1);
    expect(await getSeededAt(handle.db)).toEqual(SEEDED);
  });

  it("новая неделя — пересев: в текущей неделе снова перенос, замена и отмена, уведомления совпадают", {
    timeout: 60_000,
  }, async () => {
    await seed(handle.db, { now: SEEDED });
    const { groupId, userId } = await student();
    // До пересева в новой неделе нет полного набора: перенос, замена и отмена есть только в неделе засева.
    const before = new Set((await changesInWeekOf(groupId, NEXT_WEEK)).map((c) => c.kind));
    expect(before.size).toBeLessThan(3);
    expect(await refreshDemoDataIfStale(handle.db, NEXT_WEEK)).toBe(true);
    expect(await getSeededAt(handle.db)).toEqual(NEXT_WEEK);

    const changes = await changesInWeekOf(groupId, NEXT_WEEK);
    expect(new Set(changes.map((c) => c.kind))).toEqual(
      new Set(["moved", "replaced", "cancelled"]),
    );

    const allNotes = (
      await handle.db
        .select({ note: schema.lessonChanges.note })
        .from(schema.lessonChanges)
        .innerJoin(schema.lessons, eq(schema.lessons.id, schema.lessonChanges.lessonId))
        .where(eq(schema.lessons.groupId, groupId))
    ).map((r) => r.note);
    const bodies = (
      await handle.db
        .select({ body: schema.notifications.body })
        .from(schema.notifications)
        .where(
          and(
            eq(schema.notifications.userId, userId),
            eq(schema.notifications.type, "schedule_change"),
          ),
        )
    ).map((r) => r.body);
    expect(bodies).toHaveLength(allNotes.length);
    for (const note of allNotes) expect(bodies.some((b) => b.includes(note))).toBe(true);
  });

  it("ошибка пересева логируется, наружу не выходит", async () => {
    const log = { log: vi.fn(), error: vi.fn() };
    await handle.close();
    expect(await refreshSafely(handle.db, NEXT_WEEK, log)).toBe(false);
    expect(log.error).toHaveBeenCalledOnce();
    // afterEach закроет ещё раз — открываем заново, чтобы не падать на повторном close.
    handle = await createDb({ url: "" });
  });
});
