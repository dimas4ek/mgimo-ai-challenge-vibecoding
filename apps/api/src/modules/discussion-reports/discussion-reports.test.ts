import { ApiErrorSchema, buildPath, routes } from "@aihs/contract";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createApp } from "../../app";
import { createDb, type DbHandle } from "../../db/client";
import { seed, seedAccounts } from "../../db/seed";

const now = new Date("2026-11-22T12:00:00Z");
const discussions = routes.me.discussions;
const staff = routes.staff.discussionReports;
const cookies = { student: "", student2: "", staff: "" };
type Account = keyof typeof cookies;
let handle: DbHandle;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  handle = await createDb({ url: "" });
  await handle.migrate();
  await seed(handle.db, { now });
  app = createApp({ db: handle.db, now: () => now });
  for (const account of Object.keys(cookies) as Account[]) {
    const response = await request(routes.auth.login.path, null, seedAccounts[account]);
    expect(response.status).toBe(200);
    cookies[account] = response.headers.get("set-cookie")?.split(";")[0] ?? "";
  }
});

afterAll(async () => handle?.close());

function request(path: string, account: Account | null, body?: unknown) {
  return app.request(path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(account ? { cookie: cookies[account] } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function addComment(scope: "university" | "department", body: string) {
  const created = await request(discussions.create.path, "student2", {
    scope,
    title: "Встреча клуба",
    body: "Обсудим новые темы.",
  });
  expect(created.status).toBe(201);
  const topic = discussions.create.response.parse(await created.json());
  const saved = await request(buildPath(discussions.comment.path, { id: topic.id }), "student2", {
    body,
  });
  expect(saved.status).toBe(201);
  const comment = discussions.comment.response.parse(await saved.json());
  return { topic, comment };
}

const reason = { reason: "Проверьте содержание" };
const reportPath = (commentId: string) => buildPath(discussions.report.path, { commentId });

async function reportComment(commentId: string, who: Account = "student") {
  const res = await request(reportPath(commentId), who, reason);
  expect(res.status).toBe(201);
  return discussions.report.response.parse(await res.json());
}

it("принимает одну жалобу от студента даже при одновременных запросах", async () => {
  const { comment } = await addComment("university", "Описание встречи для всех.");
  const [first, second] = await Promise.all([
    request(reportPath(comment.id), "student", reason),
    request(reportPath(comment.id), "student", reason),
  ]);
  expect([first.status, second.status].sort()).toEqual([201, 409]);
  const conflict = first.status === 409 ? first : second;
  expect(ApiErrorSchema.parse(await conflict.json()).error.code).toBe("duplicate_report");
  const queue = await request(staff.list.path, "staff");
  expect(queue.status).toBe(200);
  const rawQueue = await queue.json();
  const reports = staff.list.response.parse(rawQueue);
  expect(rawQueue).toEqual(reports);
  expect(reports.filter((r) => r.commentId === comment.id)).toHaveLength(1);
});

it("проверяет доступность комментария, сессию, роль и входные данные", async () => {
  const { comment } = await addComment("department", "Только для своей кафедры.");
  const path = reportPath(comment.id);
  expect((await request(path, "student", reason)).status).toBe(404);
  expect((await request(path, null, reason)).status).toBe(401);
  expect((await request(path, "staff", reason)).status).toBe(403);
  expect((await request(path, "student2", { reason: "  " })).status).toBe(400);
  expect(
    (await request(reportPath("00000000-0000-4000-8000-000000000000"), "student", reason)).status,
  ).toBe(404);
  await reportComment(comment.id, "student2");
});

it("скрывает текст у студентов и закрывает остальные жалобы на тот же комментарий", async () => {
  const original = "Текст, скрываемый модератором";
  const { topic, comment } = await addComment("university", original);
  const report = await reportComment(comment.id);
  const second = await reportComment(comment.id, "student2");
  const detail = buildPath(staff.get.path, { id: report.id });
  const decision = buildPath(staff.resolve.path, { id: report.id });
  const res = await request(decision, "staff", { decision: "hide" });
  expect(res.status).toBe(200);
  const result = staff.resolve.response.parse(await res.json());
  expect(result).toMatchObject({
    status: "hidden",
    resolvedAt: now.toISOString(),
    comment: { visibility: "hidden", body: original },
  });
  expect(await (await request(detail, "staff")).json()).toEqual(result);
  const other = await request(buildPath(staff.get.path, { id: second.id }), "staff");
  expect(staff.get.response.parse(await other.json()).status).toBe("hidden");
  expect((await request(decision, "staff", { decision: "dismiss" })).status).toBe(409);

  for (const student of ["student", "student2"] as const) {
    const reply = await request(buildPath(discussions.get.path, { id: topic.id }), student);
    expect(reply.status).toBe(200);
    const raw = await reply.text();
    expect(raw).not.toContain(original);
    expect(discussions.get.response.parse(JSON.parse(raw)).comments).toEqual([
      { ...comment, visibility: "hidden", body: null },
    ]);
    expect((await request(reportPath(comment.id), student, reason)).status).toBe(404);
  }
});

it("сохраняет отклонение жалобы и оставляет комментарий видимым", async () => {
  const { topic, comment } = await addComment("university", "Ответ остаётся доступным.");
  const report = await reportComment(comment.id);
  const decision = buildPath(staff.resolve.path, { id: report.id });
  const response = await request(decision, "staff", { decision: "dismiss" });
  expect(response.status).toBe(200);
  const result = staff.resolve.response.parse(await response.json());
  expect(result).toMatchObject({
    status: "dismissed",
    resolvedAt: now.toISOString(),
    comment: { visibility: "visible" },
  });
  expect(
    await (await request(buildPath(staff.get.path, { id: report.id }), "staff")).json(),
  ).toEqual(result);
  const discussion = await request(buildPath(discussions.get.path, { id: topic.id }), "student");
  expect(discussions.get.response.parse(await discussion.json()).comments).toEqual([comment]);
});

it("закрывает очередь, детали и решения для студентов и гостей", async () => {
  const id = "00000000-0000-4000-8000-000000000000";
  const detail = buildPath(staff.get.path, { id });
  const decision = buildPath(staff.resolve.path, { id });
  for (const [path, body] of [
    [staff.list.path],
    [detail],
    [decision, { decision: "hide" }],
  ] as const) {
    expect((await request(path, null, body)).status).toBe(401);
    expect((await request(path, "student", body)).status).toBe(403);
  }
  expect((await request(detail, "staff")).status).toBe(404);
  expect((await request(decision, "staff", { decision: "ignore" })).status).toBe(400);
  expect((await request(decision, "staff", { decision: "hide" })).status).toBe(404);
});
