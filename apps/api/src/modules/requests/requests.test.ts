import {
  ApiErrorSchema,
  buildPath,
  RequestListItemSchema,
  RequestSchema,
  routes,
  StaffRequestItemSchema,
} from "@aihs/contract";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { createApp } from "../../app";
import { createDb, type DbHandle } from "../../db/client";
import { seed, seedAccounts } from "../../db/seed";
import { changeRequestStatus, listAllRequests } from "./service";

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

const as = (who: keyof typeof cookies | null, init: RequestInit = {}): RequestInit => ({
  ...init,
  headers: {
    ...(init.body ? { "content-type": "application/json" } : {}),
    ...(who ? { cookie: cookies[who] } : {}),
  },
});

const create = (who: keyof typeof cookies | null, body: unknown) =>
  app.request(
    routes.me.requests.create.path,
    as(who, { method: "POST", body: JSON.stringify(body) }),
  );

const errorCode = async (res: Response) => ApiErrorSchema.parse(await res.json()).error.code;

describe("POST /api/me/requests", () => {
  it("создаёт заявку: 201, статус submitted, одна запись в истории", async () => {
    const res = await create("student", { type: "transcript", comment: "  Для стажировки  " });
    expect(res.status).toBe(201);
    const body = RequestSchema.parse(await res.json());
    expect(body).toMatchObject({
      type: "transcript",
      status: "submitted",
      comment: "Для стажировки",
    });
    expect(body.createdAt).toBe(NOW.toISOString());
    expect(body.history).toEqual([{ status: "submitted", at: NOW.toISOString(), comment: null }]);
  });

  it.each([
    ["неизвестный тип", { type: "free_money" }],
    ["нет типа", { comment: "x" }],
    ["слишком длинный комментарий", { type: "transcript", comment: "x".repeat(1001) }],
  ])("невалидный ввод (%s) → 400 validation", async (_name, body) => {
    const res = await create("student", body);
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe("validation");
  });

  it("без сессии → 401", async () => {
    const res = await create(null, { type: "transcript" });
    expect(res.status).toBe(401);
  });

  it("сотруднику → 403", async () => {
    const res = await create("staff", { type: "transcript" });
    expect(res.status).toBe(403);
  });

  it("student_id из тела игнорируется: заявка всё равно своя", async () => {
    const other = await app.request(routes.me.requests.list.path, as("student2"));
    const before = z.array(RequestListItemSchema).parse(await other.json()).length;
    const res = await create("student", {
      type: "enrollment_certificate",
      studentId: "00000000-0000-4000-8000-000000000000",
    });
    expect(res.status).toBe(201);
    const after = await app.request(routes.me.requests.list.path, as("student2"));
    expect(z.array(RequestListItemSchema).parse(await after.json())).toHaveLength(before);
  });
});

describe("GET /api/me/requests", () => {
  it("только свои, по схеме, новые сверху", async () => {
    const res = await app.request(routes.me.requests.list.path, as("student"));
    expect(res.status).toBe(200);
    const list = z.array(RequestListItemSchema).parse(await res.json());
    expect(list.length).toBeGreaterThan(0);
    const dates = list.map((r) => r.createdAt);
    expect(dates).toEqual([...dates].sort().reverse());

    const other = await app.request(routes.me.requests.list.path, as("student2"));
    const otherIds = new Set(
      z
        .array(RequestListItemSchema)
        .parse(await other.json())
        .map((r) => r.id),
    );
    expect(list.some((r) => otherIds.has(r.id))).toBe(false);
  });

  it("без сессии → 401", async () => {
    expect((await app.request(routes.me.requests.list.path)).status).toBe(401);
  });
});

describe("GET /api/me/requests/:id", () => {
  it("своя заявка — карточка с историей", async () => {
    const created = RequestSchema.parse(
      await (await create("student", { type: "transcript" })).json(),
    );
    const res = await app.request(
      buildPath(routes.me.requests.get.path, { id: created.id }),
      as("student"),
    );
    expect(res.status).toBe(200);
    expect(RequestSchema.parse(await res.json())).toEqual(created);
  });

  it("чужая заявка → 404, как несуществующая", async () => {
    const foreign = RequestSchema.parse(
      await (await create("student2", { type: "transcript" })).json(),
    );
    const res = await app.request(
      buildPath(routes.me.requests.get.path, { id: foreign.id }),
      as("student"),
    );
    expect(res.status).toBe(404);
    expect(await errorCode(res)).toBe("not_found");

    const missing = await app.request(
      buildPath(routes.me.requests.get.path, { id: "00000000-0000-4000-8000-000000000000" }),
      as("student"),
    );
    expect(missing.status).toBe(404);
  });

  it("невалидный id → 404 (а не 500)", async () => {
    const res = await app.request(
      buildPath(routes.me.requests.get.path, { id: "1 OR 1=1" }),
      as("student"),
    );
    expect(res.status).toBe(404);
  });

  it("без сессии → 401", async () => {
    const res = await app.request(
      buildPath(routes.me.requests.get.path, { id: "00000000-0000-4000-8000-000000000000" }),
    );
    expect(res.status).toBe(401);
  });
});

describe("сервис для кабинета сотрудника (#10)", () => {
  it("changeRequestStatus: история, updatedAt, ФИО и группа; закрытую менять нельзя", async () => {
    const created = RequestSchema.parse(
      await (await create("student", { type: "transcript" })).json(),
    );
    const later = new Date("2026-11-19T10:00:00Z");

    const r1 = await changeRequestStatus(handle.db, created.id, { status: "in_review" }, later);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    const item = StaffRequestItemSchema.parse(r1.item);
    expect(item.status).toBe("in_review");
    expect(item.updatedAt).toBe(later.toISOString());
    expect(item.history.map((h) => h.status)).toEqual(["submitted", "in_review"]);
    expect(item.student.fullName).toMatch(/Лебедянская/);
    expect(item.student.group).not.toBe("—");

    // Следующая смена позже: история упорядочена по времени.
    const evenLater = new Date("2026-11-19T11:00:00Z");
    const r2 = await changeRequestStatus(
      handle.db,
      created.id,
      { status: "ready", comment: "Готово" },
      evenLater,
    );
    expect(r2.ok && r2.item.history.map((h) => h.status)).toEqual([
      "submitted",
      "in_review",
      "ready",
    ]);
    expect(r2.ok && r2.item.history.at(-1)?.comment).toBe("Готово");

    const r3 = await changeRequestStatus(handle.db, created.id, { status: "rejected" }, later);
    expect(r3).toEqual({ ok: false, reason: "final" });

    const r4 = await changeRequestStatus(
      handle.db,
      "00000000-0000-4000-8000-000000000000",
      { status: "in_review" },
      later,
    );
    expect(r4).toEqual({ ok: false, reason: "not_found" });

    // Студент видит новый статус в своей карточке.
    const res = await app.request(
      buildPath(routes.me.requests.get.path, { id: created.id }),
      as("student"),
    );
    expect(RequestSchema.parse(await res.json()).status).toBe("ready");
  });

  it("listAllRequests: заявки обоих студентов, фильтр по статусу", async () => {
    const all = await listAllRequests(handle.db, {});
    z.array(StaffRequestItemSchema).parse(all);
    const groups = new Set(all.map((r) => r.student.group));
    expect(groups.size).toBeGreaterThanOrEqual(2);

    const submitted = await listAllRequests(handle.db, { status: "submitted" });
    expect(submitted.length).toBeGreaterThan(0);
    expect(submitted.every((r) => r.status === "submitted")).toBe(true);
  });
});
