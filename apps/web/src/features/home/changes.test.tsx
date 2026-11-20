// @vitest-environment jsdom
import { fixtures, type Lesson, routes, type WeekSchedule } from "@aihs/contract";
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
import { changesWindowEnd, upcomingChanges } from "./model";

const lesson = (id: string, date: string, start: string, end: string, change: boolean): Lesson => ({
  id,
  date,
  start,
  end,
  subject: `Предмет ${id}`,
  type: "seminar",
  room: "А-1",
  teacher: "Преподаватель",
  change: change
    ? { kind: "cancelled", note: `Отмена ${id}`, originalDate: null, originalStart: null }
    : null,
});

describe("upcomingChanges", () => {
  const lessons = [
    lesson("прошла", "2026-11-19", "09:00", "10:30", true),
    lesson("идёт", "2026-11-19", "10:45", "12:15", true),
    lesson("без изменений", "2026-11-19", "13:00", "14:30", false),
    lesson("послезавтра", "2026-11-21", "09:00", "10:30", true),
    lesson("за окном", "2026-11-22", "09:00", "10:30", true),
    lesson("завтра", "2026-11-20", "09:00", "10:30", true),
    lesson("вчера", "2026-11-18", "09:00", "10:30", true),
  ];

  it("сегодня и 2 дня вперёд, только с изменением, закончившиеся не показываем, по порядку", () => {
    // 19.11 11:00 МСК.
    const ids = upcomingChanges(lessons, new Date("2026-11-19T08:00:00Z")).map((l) => l.id);
    expect(ids).toEqual(["идёт", "завтра", "послезавтра"]);
  });

  it("«сегодня» — по Москве, а не по часам устройства", () => {
    // 18.11 22:30 UTC — в Москве уже 19.11 01:30: «вчера» (18.11) не попадает, «за окном» (22.11) — тоже.
    const ids = upcomingChanges(lessons, new Date("2026-11-18T22:30:00Z")).map((l) => l.id);
    expect(ids).toEqual(["прошла", "идёт", "завтра", "послезавтра"]);
  });

  it("окно на стыке недель: воскресенье + понедельник и вторник следующей", () => {
    expect(changesWindowEnd(new Date("2026-11-22T09:00:00Z"))).toBe("2026-11-24");
    const ids = upcomingChanges(
      [
        lesson("пн", "2026-11-23", "09:00", "10:30", true),
        lesson("ср", "2026-11-25", "09:00", "10:30", true),
      ],
      new Date("2026-11-22T09:00:00Z"),
    ).map((l) => l.id);
    expect(ids).toEqual(["пн"]);
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

function open(now: Date) {
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

const block = () => screen.findByRole("region", { name: "Изменения в расписании" });

describe("блок «Изменения в расписании»", () => {
  it("четверг 09:30 МСК: замена сегодня и отмена завтра; ссылка на неделю", async () => {
    open(new Date("2026-11-19T06:30:00Z"));
    const region = await block();
    const cards = await within(region).findAllByRole("article");
    expect(cards).toHaveLength(2);
    expect(cards[0]?.textContent).toContain("Этика искусственного интеллекта");
    expect(cards[1]?.textContent).toContain("Теория вероятностей и статистика");
    expect(
      within(region)
        .getByRole("link", { name: "Всё расписание на эту неделю" })
        .getAttribute("href"),
    ).toBe(`${paths.schedule}?week=2026-11-16`);
  });

  it("изменений в окне нет — блока нет", async () => {
    const plain: WeekSchedule = {
      ...fixtures.weekSchedule,
      lessons: fixtures.weekSchedule.lessons.map((l) => ({ ...l, change: null })),
    };
    server.use(http.get(routes.me.schedule.path, () => HttpResponse.json(plain)));
    open(new Date("2026-11-19T06:30:00Z"));
    expect(await screen.findByRole("region", { name: "Следующая пара" })).toBeTruthy();
    await within(await screen.findByRole("region", { name: "Следующая пара" })).findByRole(
      "article",
    );
    expect(screen.queryByRole("region", { name: "Изменения в расписании" })).toBeNull();
  });

  it("на стыке недель догружает следующую неделю", async () => {
    const requested: (string | null)[] = [];
    const nextWeek: WeekSchedule = {
      weekStart: "2026-11-23",
      weekEnd: "2026-11-29",
      lessons: [
        { ...lesson("x", "2026-11-23", "09:00", "10:30", true), id: fixtures.ids.request1 },
      ],
    };
    server.use(
      http.get(routes.me.schedule.path, ({ request }) => {
        const week = new URL(request.url).searchParams.get("week");
        requested.push(week);
        return HttpResponse.json(week ? nextWeek : fixtures.weekSchedule);
      }),
    );
    // Воскресенье 22.11 12:00 МСК: окно 22–24.11.
    open(new Date("2026-11-22T09:00:00Z"));
    const region = await block();
    expect(await within(region).findByText(/Отмена x/)).toBeTruthy();
    expect(requested).toContain("2026-11-24");
  });
});
