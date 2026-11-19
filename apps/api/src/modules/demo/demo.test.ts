import {
  buildPath,
  NotificationListSchema,
  OkSchema,
  RequestListItemSchema,
  RequestSchema,
  routes,
} from "@aihs/contract";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { createApp } from "../../app";
import { createDb, type DbHandle } from "../../db/client";
import { seed, seedAccounts } from "../../db/seed";

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

type Who = keyof typeof cookies;
const send = (who: Who | null, path: string, init: RequestInit = {}) =>
  app.request(path, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(who ? { cookie: cookies[who] } : {}),
    },
  });

const requests = async (who: Who) =>
  z
    .array(RequestListItemSchema)
    .parse(await (await send(who, routes.me.requests.list.path)).json());
const feed = async (who: Who) =>
  NotificationListSchema.parse(await (await send(who, routes.me.notifications.list.path)).json());
const createRequest = async (who: Who) =>
  RequestSchema.parse(
    await (
      await send(who, routes.me.requests.create.path, {
        method: "POST",
        body: JSON.stringify({ type: "transcript", comment: "Демо-заявка жюри" }),
      })
    ).json(),
  );
const readAll = async (who: Who) => {
  for (const n of (await feed(who)).items.filter((i) => !i.read)) {
    await send(who, buildPath(routes.me.notifications.markRead.path, { id: n.id }), {
      method: "POST",
    });
  }
};
const reset = (who: Who | null) => send(who, routes.me.demoReset.path, { method: "POST" });

describe("POST /api/me/demo-reset", () => {
  it("возвращает заявки и уведомления своего аккаунта к сиду, чужие данные не меняются", async () => {
    const seedMine = await requests("student");
    const seedUnread = (await feed("student")).unreadCount;
    expect(seedUnread).toBeGreaterThan(0);

    // Жюри «наигралось» под обоими студентами.
    const mine = await createRequest("student");
    await readAll("student");
    const theirs = await createRequest("student2");
    await readAll("student2");
    const theirsBefore = { requests: await requests("student2"), feed: await feed("student2") };

    const res = await reset("student");
    expect(res.status).toBe(200);
    expect(OkSchema.parse(await res.json())).toEqual({ ok: true });

    // Свои данные — как в сиде: новой заявки нет, непрочитанные снова непрочитанные.
    const after = await requests("student");
    expect(after).toEqual(seedMine);
    expect(after.some((r) => r.id === mine.id)).toBe(false);
    expect((await feed("student")).unreadCount).toBe(seedUnread);
    const gone = await send("student", buildPath(routes.me.requests.get.path, { id: mine.id }));
    expect(gone.status).toBe(404);

    // Чужие — ровно как до сброса, включая созданную заявку и прочитанные уведомления.
    expect(await requests("student2")).toEqual(theirsBefore.requests);
    expect((await requests("student2")).some((r) => r.id === theirs.id)).toBe(true);
    expect(await feed("student2")).toEqual(theirsBefore.feed);
  });

  it("повторный сброс безопасен", async () => {
    const before = await requests("student");
    expect((await reset("student")).status).toBe(200);
    expect(await requests("student")).toEqual(before);
  });

  it("без сессии → 401, сотруднику → 403", async () => {
    expect((await reset(null)).status).toBe(401);
    expect((await reset("staff")).status).toBe(403);
  });
});
