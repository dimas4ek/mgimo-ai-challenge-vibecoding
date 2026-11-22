// @vitest-environment jsdom
import { fixtures, routes, type WeekSchedule } from "@aihs/contract";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryClient } from "../../api";
import { handlers, resetMockDb } from "../../mocks/handlers";
import { SchedulePage } from "./SchedulePage";

// Фикстурная неделя 16–22.11.2026: перенос 17.11, замена 19.11, отмена 20.11, в среду 18.11 пар нет.
const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
beforeEach(() => resetMockDb({ as: "student" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.useRealTimers();
});
afterAll(() => server.close());

/** «Сейчас» по Москве. Подменяем только Date, таймеры остаются настоящими. */
function at(date: string, time: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${date}T${time}:00+03:00`));
}

function renderAt(url: string) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  const router = createMemoryRouter([{ path: "/schedule", element: <SchedulePage /> }], {
    initialEntries: [url],
  });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

/** Карточка пары по названию предмета. */
const card = (subject: string | RegExp) => {
  const article = screen.getByRole("heading", { name: subject }).closest("article");
  if (!article) throw new Error("нет карточки");
  return article;
};

describe("SchedulePage", () => {
  it("сначала скелетон, затем пары сегодняшнего дня; перенос — текстом, иконкой и пояснением", async () => {
    at("2026-11-17", "10:00");
    renderAt("/schedule");
    expect(screen.getByRole("status")).toHaveProperty("textContent", "Загружаем расписание…");
    await screen.findByRole("heading", { name: "Обработка естественного языка" });
    const moved = card("Обработка естественного языка");
    const badge = within(moved).getByText("Перенос");
    expect(badge.querySelector("svg")).not.toBeNull();
    expect(moved.textContent).toContain(fixtures.weekSchedule.lessons[2]?.change?.note);
    // Пары других дней на вкладке «Сегодня» не показываются.
    expect(screen.queryByRole("heading", { name: "Машинное обучение" })).toBeNull();
    expect(screen.getByRole("tab", { name: "Сегодня" }).getAttribute("aria-selected")).toBe("true");
  });

  it("идущая пара подписана «Идёт сейчас»", async () => {
    at("2026-11-17", "13:30");
    renderAt("/schedule");
    await screen.findByRole("heading", { name: "Обработка естественного языка" });
    expect(within(card("Обработка естественного языка")).getByText("Идёт сейчас")).toBeTruthy();
  });

  it("сегодня пар нет — пустое состояние и ближайшая пара с датой", async () => {
    at("2026-11-18", "08:00");
    renderAt("/schedule");
    await screen.findByText("Сегодня пар нет");
    const next = screen.getByRole("region", { name: "Ближайшая пара" });
    expect(
      within(next).getByRole("heading", { name: "Этика искусственного интеллекта" }),
    ).toBeTruthy();
    expect(next.textContent).toContain("Четверг, 19 ноября");
    expect(within(next).getByText("Замена")).toBeTruthy();
  });

  it("неделя: дни с заголовками, отменённая пара зачёркнута и подписана", async () => {
    at("2026-11-17", "10:00");
    renderAt("/schedule?view=week");
    await screen.findByRole("heading", { name: "Понедельник, 16 ноября" });
    expect(screen.getByText("16–22 ноября")).toBeTruthy();
    const cancelled = card("Теория вероятностей и статистика");
    expect(within(cancelled).getByText("Отменена").querySelector("svg")).not.toBeNull();
    expect(
      within(cancelled).getByRole("heading", { name: "Теория вероятностей и статистика" })
        .className,
    ).toContain("line-through");
    // Сегодняшний день отмечен текстом, а не только цветом.
    expect(
      within(screen.getByRole("heading", { name: /Вторник, 17 ноября/ })).getByText("Сегодня"),
    ).toBeTruthy();
  });

  it("точка входа Tab совпадает с выбором, стрелки перемещают только фокус", async () => {
    at("2026-11-17", "10:00");
    renderAt("/schedule?view=week");
    await screen.findByRole("heading", { name: "Понедельник, 16 ноября" });
    const today = screen.getByRole("tab", { name: "Сегодня" });
    const week = screen.getByRole("tab", { name: "Неделя" });
    const weekPanel = screen.getByRole("tabpanel", { name: "Неделя" });
    expect(week.tabIndex).toBe(0);
    expect(today.tabIndex).toBe(-1);
    expect(week.getAttribute("aria-controls")).toBe(weekPanel.id);
    expect(weekPanel.getAttribute("aria-labelledby")).toBe(week.id);
    act(() => week.focus());

    fireEvent.keyDown(week, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(today);
    expect(today.tabIndex).toBe(0);
    expect(week.getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(today, { key: "ArrowRight" });
    expect(document.activeElement).toBe(week);

    fireEvent.keyDown(week, { key: "Home" });
    expect(document.activeElement).toBe(today);
    act(() => weekPanel.focus());
    expect(week.tabIndex).toBe(0);
    expect(today.tabIndex).toBe(-1);
    fireEvent.click(today);
    const todayPanel = screen.getByRole("tabpanel", { name: "Сегодня" });
    expect(today.getAttribute("aria-controls")).toBe(todayPanel.id);
    expect(todayPanel.getAttribute("aria-labelledby")).toBe(today.id);
    expect(weekPanel).toHaveProperty("hidden", true);
    await screen.findByRole("heading", { name: "Обработка естественного языка" });
  });

  it("ссылка ?week= из уведомления открывает нужную неделю и запрашивает её у API", async () => {
    at("2026-11-25", "10:00");
    const weeks: (string | null)[] = [];
    server.events.on("request:start", ({ request }) => {
      const url = new URL(request.url);
      if (url.pathname === routes.me.schedule.path) weeks.push(url.searchParams.get("week"));
    });
    renderAt("/schedule?week=2026-11-18");
    await screen.findByRole("heading", { name: "Понедельник, 16 ноября" });
    expect(screen.getByRole("tab", { name: "Неделя" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("button", { name: "К текущей неделе" })).toBeTruthy();
    expect(weeks).toContain("2026-11-16");
    server.events.removeAllListeners();
  });

  it.each(["2026-13-01", "2026-02-30", "1999-12-31", "2100-01-01", ""])(
    "неверная дата %j открывает текущую неделю и удаляется из адреса",
    async (week) => {
      at("2026-11-17", "10:00");
      const router = renderAt(`/schedule?week=${week}&source=notification`);
      await screen.findByRole("heading", { name: "Понедельник, 16 ноября" });
      expect(screen.getByText("Текущая неделя")).toBeTruthy();
      const params = new URLSearchParams(router.state.location.search);
      expect(params.get("view")).toBe("week");
      expect(params.has("week")).toBe(false);
      expect(params.get("source")).toBe("notification");
      expect(router.state.historyAction).toBe("REPLACE");
    },
  );

  it("запрашивает первую доступную неделю по дате внутри диапазона", async () => {
    at("2026-11-17", "10:00");
    let requestedWeek: string | null = null;
    server.use(
      http.get(routes.me.schedule.path, ({ request }) => {
        requestedWeek = new URL(request.url).searchParams.get("week");
        return HttpResponse.json({
          weekStart: "1999-12-27",
          weekEnd: "2000-01-02",
          lessons: [],
        } satisfies WeekSchedule);
      }),
    );
    renderAt("/schedule?week=2000-01-01");
    await screen.findByText("На этой неделе пар нет");
    expect(requestedWeek).toBe("2000-01-02");
    expect(screen.getByRole("button", { name: "Предыдущая неделя" })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("листание: «Следующая неделя» меняет адрес", async () => {
    at("2026-11-17", "10:00");
    const router = renderAt("/schedule?view=week");
    await screen.findByRole("heading", { name: "Понедельник, 16 ноября" });
    fireEvent.click(screen.getByRole("button", { name: "Следующая неделя" }));
    expect(router.state.location.search).toContain("week=2026-11-23");
    expect(screen.getByText("23–29 ноября")).toBeTruthy();
  });

  it("пустая неделя — понятный текст", async () => {
    at("2026-11-17", "10:00");
    server.use(
      http.get(routes.me.schedule.path, () =>
        HttpResponse.json({
          weekStart: "2026-11-16",
          weekEnd: "2026-11-22",
          lessons: [],
        } satisfies WeekSchedule),
      ),
    );
    renderAt("/schedule?view=week");
    expect(await screen.findByText("На этой неделе пар нет")).toBeTruthy();
  });

  it("ошибка — сообщение и «Повторить», после повтора данные на месте", async () => {
    at("2026-11-17", "10:00");
    server.use(
      http.get(routes.me.schedule.path, () =>
        HttpResponse.json({ error: { code: "internal", message: "сбой" } }, { status: 500 }),
      ),
    );
    renderAt("/schedule");
    await screen.findByRole("alert");
    expect(screen.getByText("Не получилось загрузить")).toBeTruthy();
    server.resetHandlers();
    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
    expect(
      await screen.findByRole("heading", { name: "Обработка естественного языка" }),
    ).toBeTruthy();
  });
});
