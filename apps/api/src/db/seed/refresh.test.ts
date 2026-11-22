import {
  buildPath,
  CertificateSchema,
  CertificateVerificationSchema,
  NotificationListSchema,
  RequestSchema,
  routes,
} from "@aihs/contract";
import { and, eq, gte, lte } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../app";
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

  it("новая неделя — в расписании снова перенос, замена и отмена, уведомления совпадают", {
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

  it("после полуночи МСК заявка, история, уведомление и выданная справка с тем же QR доступны через API", {
    timeout: 60_000,
  }, async () => {
    await seed(handle.db, { now: SEEDED });
    let now = SAME_WEEK;
    const app = createApp({ db: handle.db, now: () => now });
    const post = (path: string, body: object, cookie?: string) =>
      app.request(path, {
        method: "POST",
        headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
        body: JSON.stringify(body),
      });
    const login = async (account: keyof typeof seedAccounts) => {
      const response = await post(routes.auth.login.path, seedAccounts[account]);
      expect(response.status).toBe(200);
      const cookie = response.headers.get("set-cookie")?.split(";")[0];
      if (!cookie) throw new Error("API не выдал cookie сессии");
      return cookie;
    };
    const cookie = await login("student");
    const otherCookie = await login("student2");
    const staff = await login("staff");
    const createRequest = async (owner: string) => {
      const response = await post(routes.me.requests.create.path, { type: "transcript" }, owner);
      expect(response.status).toBe(201);
      return RequestSchema.parse(await response.json());
    };
    const { id } = await createRequest(cookie);
    const other = await createRequest(otherCookie);
    now = new Date(SAME_WEEK.getTime() + 1000);
    const ready = await post(
      buildPath(routes.staff.requests.changeStatus.path, { id }),
      { status: "ready" },
      staff,
    );
    expect(ready.status).toBe(200);

    const requestPath = buildPath(routes.me.requests.get.path, { id });
    const certificatePath = buildPath(routes.me.certificates.get.path, { requestId: id });
    const get = (path: string) => app.request(path, { headers: { cookie } });
    const readUserData = async () => {
      const request = RequestSchema.parse(await (await get(requestPath)).json());
      const certificate = CertificateSchema.parse(await (await get(certificatePath)).json());
      const { items } = NotificationListSchema.parse(
        await (await get(routes.me.notifications.list.path)).json(),
      );
      const notification = items.find((item) => item.link === `/requests/${id}`);
      return { request, certificate, notification };
    };

    const before = await readUserData();
    expect(before.request.history.map((entry) => entry.status)).toEqual(["submitted", "ready"]);
    expect(before.notification).toMatchObject({ type: "request" });
    const qrPath = buildPath(routes.public.certificates.verify.path, {
      token: before.certificate.token,
    });
    const qrBefore = CertificateVerificationSchema.parse(await (await app.request(qrPath)).json());

    now = NEXT_WEEK;
    expect(await refreshDemoDataIfStale(handle.db, now)).toBe(true);
    expect(await refreshDemoDataIfStale(handle.db, now)).toBe(false);
    expect(await readUserData()).toEqual(before);
    expect(CertificateVerificationSchema.parse(await (await app.request(qrPath)).json())).toEqual(
      qrBefore,
    );

    const reset = await app.request(routes.me.demoReset.path, {
      method: "POST",
      headers: { cookie },
    });
    expect(reset.status).toBe(200);
    expect((await get(requestPath)).status).toBe(404);
    expect((await app.request(qrPath)).status).toBe(404);
    const otherResponse = await app.request(
      buildPath(routes.me.requests.get.path, { id: other.id }),
      {
        headers: { cookie: otherCookie },
      },
    );
    expect(RequestSchema.parse(await otherResponse.json())).toEqual(other);
  });

  it("старая база без отметки засева сохраняет заявки при обновлении", {
    timeout: 60_000,
  }, async () => {
    await seed(handle.db, { now: SEEDED });
    await handle.db.delete(schema.seedMeta);
    const { id } = await student();
    const [created] = await handle.db
      .insert(schema.requests)
      .values({ studentId: id, type: "transcript", createdAt: SEEDED, updatedAt: SEEDED })
      .returning();
    expect(await refreshDemoDataIfStale(handle.db, NEXT_WEEK)).toBe(true);
    expect(await getSeededAt(handle.db)).toEqual(NEXT_WEEK);
    const [still] = await handle.db
      .select()
      .from(schema.requests)
      .where(eq(schema.requests.id, created?.id ?? ""));
    expect(still).toEqual(created);
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
