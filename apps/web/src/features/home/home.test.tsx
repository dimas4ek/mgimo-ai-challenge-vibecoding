// @vitest-environment jsdom
import { fixtures, type Notification, routes } from "@aihs/contract";
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createQueryClient } from "../../api/hooks";
import { paths } from "../../app/paths";
import { handlers, resetMockDb } from "../../mocks/handlers";
import { HomePage } from "./HomePage";
import {
  firstName,
  greeting,
  HOME_LIMIT,
  homeAnnouncements,
  homeDeadlines,
  recentRequestUpdates,
} from "./model";

// Четверг 19.11, 12:00 по Москве.
const NOW = new Date("2026-11-19T09:00:00Z");

describe("модель главной", () => {
  it.each([
    ["2026-11-19T02:30:00Z", "Доброе утро"], // 05:30 МСК
    ["2026-11-19T08:59:00Z", "Доброе утро"], // 11:59
    ["2026-11-19T09:00:00Z", "Добрый день"], // 12:00
    ["2026-11-19T14:00:00Z", "Добрый вечер"], // 17:00
    ["2026-11-19T20:00:00Z", "Доброй ночи"], // 23:00
    ["2026-11-19T01:59:00Z", "Доброй ночи"], // 04:59
  ])("greeting(%s) → «%s» по Москве", (iso, text) => {
    expect(greeting(new Date(iso))).toBe(text);
  });

  it("firstName берёт первое слово", () => {
    expect(firstName("  Мирослава Лебедянская ")).toBe("Мирослава");
    expect(firstName("Тихон")).toBe("Тихон");
  });

  const note = (over: Partial<Notification>): Notification => ({
    id: crypto.randomUUID(),
    type: "deadline",
    title: "т",
    body: "",
    createdAt: "2026-11-10T00:00:00.000Z",
    read: true,
    link: null,
    ...over,
  });

  it("дедлайны по сроку, включая сегодня, без просроченных и старых записей без даты", () => {
    const items = [
      note({ title: "позже", dueDate: "2026-12-02", read: false }),
      note({ title: "сегодня", dueDate: "2026-11-19", createdAt: "2026-11-01T00:00:00.000Z" }),
      note({ title: "через неделю", dueDate: "2026-11-26", createdAt: "2026-11-18T00:00:00.000Z" }),
      note({ title: "завтра", dueDate: "2026-11-20" }),
      note({ title: "просрочен", dueDate: "2026-11-18", read: false }),
      note({ title: "старое без срока", read: false }),
      note({ type: "news", title: "новость", dueDate: "2026-11-19" }),
    ];
    const shown = homeDeadlines(items, NOW);
    expect(shown.map((n) => n.title)).toEqual(["сегодня", "завтра", "через неделю"]);
    expect(shown).toHaveLength(HOME_LIMIT);
    expect(homeAnnouncements(items).map((n) => n.title)).toEqual(["новость"]);
  });

  it("заявки: статус сменился за 7 дней, свежие сверху; submitted и старые — нет", () => {
    const list = fixtures.requests;
    const updated = recentRequestUpdates(list, NOW).map((r) => r.status);
    expect(updated).toEqual(["in_review", "ready"]);
    const later = new Date("2026-11-21T12:00:00Z"); // ready от 13.11 уже старше недели
    expect(recentRequestUpdates(list, later).map((r) => r.status)).toEqual(["in_review"]);
  });
});

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
beforeEach(() => resetMockDb({ as: "student" }));

// Для экрана: 09:30 по Москве — четверговая пара 09:00–10:30 идёт прямо сейчас.
const MORNING = new Date("2026-11-19T06:30:00Z");

function open(now = MORNING) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  const router = createMemoryRouter([{ path: paths.home, element: <HomePage now={now} /> }], {
    initialEntries: [paths.home],
  });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

const block = (name: string) => screen.getByRole("region", { name });

describe("главная «Сегодня»", () => {
  it("приветствие по имени и дате, четыре блока со ссылкой «Все» в раздел", async () => {
    open();
    expect(screen.getByRole("heading", { level: 1, name: "Сегодня" })).toBeTruthy();
    expect(await screen.findByText(/Доброе утро, Мирослава! Четверг, 19 ноября\./)).toBeTruthy();
    const links: [string, string, string][] = [
      ["Следующая пара", "Всё расписание", paths.schedule],
      ["Дедлайны", "Все дедлайны", paths.notificationDeadlines],
      ["Заявки", "Все заявки", paths.requests],
      ["Объявления деканата", "Все уведомления", paths.notifications],
    ];
    for (const [name, label, href] of links) {
      const all = within(block(name)).getByRole("link", { name: label });
      expect(all.getAttribute("href")).toBe(href);
    }
  });

  it("данные: пара, дедлайн, заявки с новым статусом, объявление", async () => {
    open();
    const lesson = await within(block("Следующая пара")).findByRole("article");
    expect(lesson.textContent).toContain("Идёт сейчас");
    expect(await screen.findByText("Сдать курсовую по ML")).toBeTruthy();
    expect(screen.getByText("до 30 ноября").getAttribute("datetime")).toBe("2026-11-30");
    expect(await within(block("Заявки")).findAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Хакатон AI High School")).toBeTruthy();
  });

  it("пусто: нет объявлений и новых статусов — короткие подписи и действие", async () => {
    server.use(
      http.get(routes.me.notifications.list.path, () =>
        HttpResponse.json({ items: [], unreadCount: 0 }),
      ),
      http.get(routes.me.requests.list.path, () => HttpResponse.json([])),
    );
    open();
    expect(await screen.findByText("Новых объявлений нет.")).toBeTruthy();
    expect(screen.getByText("Ближайших дедлайнов нет.")).toBeTruthy();
    expect(await screen.findByText("За неделю статусы не менялись.")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Заказать справку/ }).getAttribute("href")).toBe(
      `${paths.requests}?new=1`,
    );
  });

  it("пар больше нет ни на этой, ни на следующей неделе — так и пишем", async () => {
    open(NOW); // 12:00: четверговая пара прошла, пятничная отменена
    expect(await screen.findByText("Ближайшие две недели пар нет.")).toBeTruthy();
  });

  it("ошибка одного блока не ломает остальные", async () => {
    server.use(
      http.get(routes.me.requests.list.path, () => HttpResponse.json({}, { status: 500 })),
    );
    open();
    expect(await within(block("Заявки")).findByRole("button", { name: "Повторить" })).toBeTruthy();
    expect(await screen.findByText("Хакатон AI High School")).toBeTruthy();
  });
});
