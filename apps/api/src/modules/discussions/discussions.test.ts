import { buildPath, routes } from "@aihs/contract";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createApp } from "../../app";
import { createDb, type DbHandle } from "../../db/client";
import { seed, seedAccounts } from "../../db/seed";
import { seedDiscussions } from "../../db/seed/discussions";

const now = new Date("2026-11-22T12:00:00Z");
const endpoints = routes.me.discussions;
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

async function list(account: Account, scope: "university" | "department") {
  const response = await request(`${endpoints.list.path}?scope=${scope}`, account);
  expect(response.status).toBe(200);
  return endpoints.list.response.parse(await response.json());
}

it("показывает общую ленту обоим студентам, у каждого своя кафедра", async () => {
  const [first, second] = await Promise.all([
    list("student", "university"),
    list("student2", "university"),
  ]);
  expect(first).toEqual(second);
  expect(first.map((topic) => topic.title)).toContain("Идеи для недели студенческих проектов");
  expect((await list("student", "department")).map((t) => t.title)).toContain(
    "Практикум по нейросетям",
  );
  expect((await list("student2", "department")).map((t) => t.title)).toEqual([
    "Встреча клуба аналитиков",
  ]);
});

it("сохраняет тему и ответ, раскрывает только имя и закрывает чужую кафедру", async () => {
  const creation = await request(endpoints.create.path, "student", {
    scope: "department",
    title: " Тема кафедры ",
    body: "Задачи практикума",
  });
  expect(creation.status).toBe(201);
  const raw = await creation.json();
  const topic = endpoints.create.response.parse(raw);
  expect(raw).toEqual(topic);
  expect(topic.title).toBe("Тема кафедры");
  expect(topic.author).toEqual({ displayName: "Мирослава Лебедянская" });
  expect((await list("student", "department")).some((t) => t.id === topic.id)).toBe(true);
  expect((await list("student2", "department")).some((t) => t.id === topic.id)).toBe(false);

  const detail = buildPath(endpoints.get.path, { id: topic.id });
  const reply = buildPath(endpoints.comment.path, { id: topic.id });
  expect((await request(detail, "student2")).status).toBe(404);
  expect((await request(reply, "student2", { body: "Чужой ответ" })).status).toBe(404);
  const saved = await request(reply, "student", { body: " Список задач " });
  expect(saved.status).toBe(201);
  const rawComment = await saved.json();
  const comment = endpoints.comment.response.parse(rawComment);
  expect(rawComment).toEqual(comment);
  expect(comment.author).toEqual(topic.author);
  expect(comment.body).toBe("Список задач");

  await seedDiscussions(handle.db, new Date(now.getTime() + 86_400_000));
  const reopened = await request(detail, "student");
  expect(reopened.status).toBe(200);
  expect(await reopened.json()).toEqual({ ...topic, comments: [comment] });
});

it("позволяет ответить студенту другой кафедры в общей теме", async () => {
  const response = await request(endpoints.create.path, "student2", {
    scope: "university",
    title: "Общий семинар",
    body: "Встречаемся в четверг",
  });
  expect(response.status).toBe(201);
  const topic = endpoints.create.response.parse(await response.json());
  expect((await request(buildPath(endpoints.get.path, { id: topic.id }), "student")).status).toBe(
    200,
  );
  expect(
    (
      await request(buildPath(endpoints.comment.path, { id: topic.id }), "student", {
        body: "Буду",
      })
    ).status,
  ).toBe(201);
});

it("проверяет роль, сессию и входные данные", async () => {
  const id = "00000000-0000-4000-8000-000000000000";
  const detail = buildPath(endpoints.get.path, { id });
  const reply = buildPath(endpoints.comment.path, { id });
  const body = { scope: "department", title: "Тема", body: "Текст" };
  for (const [path, data] of [
    [`${endpoints.list.path}?scope=department`],
    [detail],
    [endpoints.create.path, body],
    [reply, { body: "Ответ" }],
  ] as const) {
    expect((await request(path, null, data)).status).toBe(401);
    expect((await request(path, "staff", data)).status).toBe(403);
  }
  expect((await request(endpoints.list.path, "student")).status).toBe(400);
  expect(
    (await request(endpoints.create.path, "student", { ...body, departmentId: id })).status,
  ).toBe(400);
  expect((await request(endpoints.create.path, "student", { ...body, title: "  " })).status).toBe(
    400,
  );
  expect((await request(reply, "student", { body: "  " })).status).toBe(400);
  expect((await request(detail, "student")).status).toBe(404);
  expect((await request(reply, "student", { body: "Ответ" })).status).toBe(404);
});
