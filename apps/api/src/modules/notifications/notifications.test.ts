import {
  ApiErrorSchema,
  buildPath,
  NotificationListSchema,
  NotificationSchema,
  routes,
} from "@aihs/contract";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { createDb, type DbHandle } from "../../db/client";
import * as schema from "../../db/schema";
import { seed, seedAccounts } from "../../db/seed";
import { notify } from "./service";

const NOW = new Date("2026-11-19T09:00:00Z");
let handle: DbHandle;
let app: ReturnType<typeof createApp>;
const cookies: Record<keyof typeof seedAccounts, string> = { student: "", student2: "", staff: "" };
const studentIds: Record<"student" | "student2", string> = { student: "", student2: "" };

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
  for (const who of ["student", "student2"] as const) {
    const [row] = await handle.db
      .select({ id: schema.students.id })
      .from(schema.students)
      .innerJoin(schema.users, eq(schema.users.id, schema.students.userId))
      .where(eq(schema.users.login, seedAccounts[who].login));
    studentIds[who] = row?.id ?? "";
  }
});

afterAll(async () => {
  await handle.close();
});

const as = (who: keyof typeof cookies | null, init: RequestInit = {}): RequestInit => ({
  ...init,
  headers: who ? { cookie: cookies[who] } : {},
});

const feed = async (who: keyof typeof cookies) => {
  const res = await app.request(routes.me.notifications.list.path, as(who));
  expect(res.status).toBe(200);
  return NotificationListSchema.parse(await res.json());
};

const read = (who: keyof typeof cookies | null, id: string) =>
  app.request(
    buildPath(routes.me.notifications.markRead.path, { id }),
    as(who, { method: "POST" }),
  );

describe("notify", () => {
  it("пишет уведомление пользователю студента; студента нет → null", async () => {
    const before = (await feed("student")).items.length;
    const at = new Date("2026-11-19T12:00:00Z");
    const sent = await notify(
      handle.db,
      studentIds.student,
      {
        type: "request",
        title: "Статус заявки изменился",
        body: "Справка готова",
        link: "/requests/x",
      },
      at,
    );
    expect(NotificationSchema.parse(sent)).toMatchObject({
      type: "request",
      read: false,
      link: "/requests/x",
      createdAt: at.toISOString(),
    });
    const after = await feed("student");
    expect(after.items).toHaveLength(before + 1);
    expect(after.items[0]?.id).toBe(sent?.id);

    const missing = await notify(
      handle.db,
      "00000000-0000-4000-8000-000000000000",
      { type: "news", title: "x", body: "y" },
      at,
    );
    expect(missing).toBeNull();
  });
});

describe("GET /api/me/notifications", () => {
  it("только свои, новые сверху, unreadCount сходится", async () => {
    await notify(handle.db, studentIds.student2, { type: "news", title: "Чужое", body: "—" }, NOW);
    const mine = await feed("student");
    const theirs = await feed("student2");
    const theirIds = new Set(theirs.items.map((n) => n.id));
    expect(mine.items.some((n) => theirIds.has(n.id))).toBe(false);
    expect(mine.unreadCount).toBe(mine.items.filter((n) => !n.read).length);
    const dates = mine.items.map((n) => n.createdAt);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it("без сессии → 401, сотруднику → 403", async () => {
    expect((await app.request(routes.me.notifications.list.path)).status).toBe(401);
    expect((await app.request(routes.me.notifications.list.path, as("staff"))).status).toBe(403);
  });
});

describe("POST /api/me/notifications/:id/read", () => {
  it("отмечает прочитанным, счётчик уменьшается, повтор безопасен", async () => {
    const sent = await notify(
      handle.db,
      studentIds.student,
      { type: "deadline", title: "Срок", body: "—" },
      NOW,
    );
    const id = sent?.id ?? "";
    const before = (await feed("student")).unreadCount;

    const res = await read("student", id);
    expect(res.status).toBe(200);
    expect(NotificationSchema.parse(await res.json())).toMatchObject({ id, read: true });
    expect((await feed("student")).unreadCount).toBe(before - 1);

    expect((await read("student", id)).status).toBe(200);
    expect((await feed("student")).unreadCount).toBe(before - 1);
  });

  it("чужое уведомление → 404 и остаётся непрочитанным", async () => {
    const foreign = await notify(
      handle.db,
      studentIds.student2,
      { type: "news", title: "Чужое", body: "—" },
      NOW,
    );
    const res = await read("student", foreign?.id ?? "");
    expect(res.status).toBe(404);
    expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("not_found");
    const theirs = await feed("student2");
    expect(theirs.items.find((n) => n.id === foreign?.id)?.read).toBe(false);
  });

  it("несуществующее и невалидный id → 404; без сессии → 401", async () => {
    expect((await read("student", "00000000-0000-4000-8000-000000000000")).status).toBe(404);
    expect((await read("student", "not-a-uuid")).status).toBe(404);
    expect((await read(null, "00000000-0000-4000-8000-000000000000")).status).toBe(401);
  });
});
