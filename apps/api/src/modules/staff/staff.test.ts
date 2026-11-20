import {
  ApiErrorSchema,
  buildPath,
  NotificationListSchema,
  RequestSchema,
  routes,
  StaffRequestItemSchema,
} from "@aihs/contract";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { createApp } from "../../app";
import { createDb, type DbHandle } from "../../db/client";
import { seed, seedAccounts } from "../../db/seed";

const NOW = new Date("2026-11-19T09:00:00Z");
/** Сотрудник отвечает позже подачи: при равном времени порядок записей истории не определён. */
const LATER = new Date("2026-11-19T10:00:00Z");
const MISSING_ID = "00000000-0000-4000-8000-000000000000";
let handle: DbHandle;
let app: ReturnType<typeof createApp>;
/** То же приложение и та же БД (сессии общие), но «сейчас» = LATER. */
let staffApp: ReturnType<typeof createApp>;
const cookies: Record<keyof typeof seedAccounts, string> = { student: "", student2: "", staff: "" };

beforeAll(async () => {
  handle = await createDb({ url: "" });
  await handle.migrate();
  await seed(handle.db, { now: NOW });
  app = createApp({ db: handle.db, now: () => NOW });
  staffApp = createApp({ db: handle.db, now: () => LATER });
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

const as = (who: keyof typeof cookies | null, init: RequestInit = {}): RequestInit => ({
  ...init,
  headers: {
    ...(init.body ? { "content-type": "application/json" } : {}),
    ...(who ? { cookie: cookies[who] } : {}),
  },
});

const errorCode = async (res: Response) => ApiErrorSchema.parse(await res.json()).error.code;

const createAs = async (who: "student" | "student2", type: string) => {
  const res = await app.request(
    routes.me.requests.create.path,
    as(who, { method: "POST", body: JSON.stringify({ type }) }),
  );
  expect(res.status).toBe(201);
  return RequestSchema.parse(await res.json());
};

const changeStatus = (who: keyof typeof cookies | null, id: string, body: unknown) =>
  staffApp.request(
    buildPath(routes.staff.requests.changeStatus.path, { id }),
    as(who, { method: "POST", body: JSON.stringify(body) }),
  );

const queue = async (status?: string) => {
  const path = status
    ? `${routes.staff.requests.list.path}?status=${status}`
    : routes.staff.requests.list.path;
  return app.request(path, as("staff"));
};

const feed = async (who: "student" | "student2") => {
  const res = await app.request(routes.me.notifications.list.path, as(who));
  expect(res.status).toBe(200);
  return NotificationListSchema.parse(await res.json());
};

describe("доступ к /api/staff/*", () => {
  it("без сессии → 401 на оба роута", async () => {
    expect((await app.request(routes.staff.requests.list.path)).status).toBe(401);
    expect((await changeStatus(null, MISSING_ID, { status: "in_review" })).status).toBe(401);
  });

  it("студенту → 403 на оба роута, статус не меняется", async () => {
    const own = await createAs("student", "transcript");
    for (const who of ["student", "student2"] as const) {
      const list = await app.request(routes.staff.requests.list.path, as(who));
      expect(list.status).toBe(403);
      expect(await errorCode(list)).toBe("forbidden");
      const post = await changeStatus(who, own.id, { status: "ready" });
      expect(post.status).toBe(403);
    }
    const card = await app.request(
      buildPath(routes.me.requests.get.path, { id: own.id }),
      as("student"),
    );
    expect(RequestSchema.parse(await card.json()).status).toBe("submitted");
  });
});

describe("GET /api/staff/requests", () => {
  it("заявки всех студентов с ФИО и группой, новые сверху", async () => {
    const a = await createAs("student", "enrollment_certificate");
    const b = await createAs("student2", "retake_application");
    const res = await queue();
    expect(res.status).toBe(200);
    const list = z.array(StaffRequestItemSchema).parse(await res.json());
    const ids = new Set(list.map((r) => r.id));
    expect(ids.has(a.id) && ids.has(b.id)).toBe(true);
    expect(new Set(list.map((r) => r.student.group)).size).toBeGreaterThanOrEqual(2);
    const dates = list.map((r) => r.createdAt);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it("фильтр по status", async () => {
    const res = await queue("rejected");
    expect(res.status).toBe(200);
    const list = z.array(StaffRequestItemSchema).parse(await res.json());
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((r) => r.status === "rejected")).toBe(true);
  });

  it("неизвестный status → 400", async () => {
    const res = await queue("deleted");
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe("validation");
  });
});

describe("POST /api/staff/requests/:id/status", () => {
  it("меняет статус: история видна студенту, студенту приходит уведомление", async () => {
    const created = await createAs("student", "scholarship_certificate");
    const before = await feed("student");
    const otherBefore = await feed("student2");

    const res = await changeStatus("staff", created.id, {
      status: "rejected",
      comment: "  Нужна справка с места работы  ",
    });
    expect(res.status).toBe(200);
    const item = StaffRequestItemSchema.parse(await res.json());
    expect(item.status).toBe("rejected");
    expect(item.student.fullName).toMatch(/Лебедянская/);

    const card = await app.request(
      buildPath(routes.me.requests.get.path, { id: created.id }),
      as("student"),
    );
    const request = RequestSchema.parse(await card.json());
    expect(request.status).toBe("rejected");
    expect(request.history).toEqual([
      { status: "submitted", at: NOW.toISOString(), comment: null },
      { status: "rejected", at: LATER.toISOString(), comment: "Нужна справка с места работы" },
    ]);

    const after = await feed("student");
    expect(after.items).toHaveLength(before.items.length + 1);
    expect(after.unreadCount).toBe(before.unreadCount + 1);
    const sent = after.items.find((n) => n.link === `/requests/${created.id}`);
    expect(sent).toMatchObject({
      type: "request",
      read: false,
      title: "Справка о стипендии: отклонена",
      body: "Нужна справка с места работы",
      createdAt: LATER.toISOString(),
    });
    expect(item.updatedAt).toBe(LATER.toISOString());

    // Чужому студенту ничего не пришло.
    expect((await feed("student2")).items).toHaveLength(otherBefore.items.length);
  });

  it("без комментария уведомление с текстом по умолчанию", async () => {
    const created = await createAs("student2", "transcript");
    const res = await changeStatus("staff", created.id, { status: "in_review" });
    expect(res.status).toBe(200);
    const sent = (await feed("student2")).items.find((n) => n.link === `/requests/${created.id}`);
    expect(sent?.title).toBe("Выписка оценок: на рассмотрении");
    expect(sent?.body.length).toBeGreaterThan(0);
  });

  it("несуществующая заявка → 404", async () => {
    const res = await changeStatus("staff", MISSING_ID, { status: "in_review" });
    expect(res.status).toBe(404);
    expect(await errorCode(res)).toBe("not_found");
  });

  it("невалидный id → 404 (а не 500)", async () => {
    const res = await changeStatus("staff", "1 OR 1=1", { status: "in_review" });
    expect(res.status).toBe(404);
    expect(await errorCode(res)).toBe("not_found");
  });

  it("закрытая заявка → 409, новая запись в историю не пишется, уведомления нет", async () => {
    const created = await createAs("student", "transcript");
    expect((await changeStatus("staff", created.id, { status: "ready" })).status).toBe(200);
    const notifications = (await feed("student")).items.length;

    const res = await changeStatus("staff", created.id, { status: "rejected", comment: "Ошибка" });
    expect(res.status).toBe(409);
    expect(await errorCode(res)).toBe("request_closed");

    const card = await app.request(
      buildPath(routes.me.requests.get.path, { id: created.id }),
      as("student"),
    );
    expect(RequestSchema.parse(await card.json()).history.map((h) => h.status)).toEqual([
      "submitted",
      "ready",
    ]);
    expect((await feed("student")).items).toHaveLength(notifications);
  });

  it.each([
    ["вернуть в submitted", { status: "submitted" }],
    ["неизвестный статус", { status: "lost" }],
    ["слишком длинный комментарий", { status: "rejected", comment: "x".repeat(1001) }],
    ["отказ без причины", { status: "rejected" }],
    ["отказ с пустой причиной", { status: "rejected", comment: "   " }],
  ])("невалидный ввод (%s) → 400", async (_name, body) => {
    const created = await createAs("student", "transcript");
    const res = await changeStatus("staff", created.id, body);
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe("validation");
  });
});
