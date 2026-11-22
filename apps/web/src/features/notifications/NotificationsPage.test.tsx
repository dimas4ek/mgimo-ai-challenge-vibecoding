// @vitest-environment jsdom
import { fixtures, type Me, routes } from "@aihs/contract";
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryClient, queryKeys } from "../../api";
import { AppShell } from "../../app/AppShell";
import { paths } from "../../app/paths";
import { handlers, resetMockDb } from "../../mocks/handlers";
import { NotificationsPage } from "./NotificationsPage";

// Фикстуры: 4 уведомления, непрочитаны два — статус заявки (19.11) и перенос семинара (15.11), оба со ссылкой.
const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
beforeEach(() => {
  resetMockDb({ as: "student" });
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-20T12:00:00+03:00"));
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.useRealTimers();
});
afterAll(() => server.close());

/** Кабинет целиком (AppShell с бейджами навигации) на адресе `url`. */
function renderAt(url: string, me: Me = fixtures.me.student) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  client.setQueryData(queryKeys.me, me);
  const router = createMemoryRouter(
    [
      {
        element: <AppShell />,
        children: [
          { path: paths.notifications, element: <NotificationsPage /> },
          { path: paths.requestPattern, element: <h1>Карточка заявки</h1> },
          { path: paths.staff, element: <h1>Кабинет сотрудника</h1> },
        ],
      },
    ],
    { initialEntries: [url] },
  );
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe("NotificationsPage", () => {
  it("скелетон, затем лента по дням; непрочитанные подписаны «Новое», тип — текстом с иконкой", async () => {
    renderAt(paths.notifications);
    expect(screen.getByRole("status").textContent).toBe("Загружаем уведомления…");
    const yesterday = await screen.findByRole("region", { name: "Вчера" });
    expect(screen.getByText("2 непрочитанных")).toBeTruthy();
    expect(screen.getAllByRole("region").map((r) => r.querySelector("h2")?.textContent)).toEqual([
      "Вчера",
      "15 ноября",
      "10 ноября",
      "9 ноября",
    ]);
    const card = within(yesterday).getByRole("link");
    expect(within(card).getByText("Новое")).toBeTruthy();
    expect(within(card).getByText("Заявка").querySelector("svg")).not.toBeNull();
    expect(within(card).getByText("10:05")).toBeTruthy();
    // Прочитанные без ссылки — без «Новое» и без кнопки.
    const news = within(screen.getByRole("region", { name: "9 ноября" })).getByRole("article");
    expect(within(news).queryByText("Новое")).toBeNull();
    expect(within(news).queryByRole("button")).toBeNull();
  });

  it("бейдж в навигации показывает число непрочитанных и уменьшается после перехода по уведомлению", async () => {
    const router = renderAt(paths.notifications);
    await screen.findByRole("region", { name: "Вчера" });
    await waitFor(() =>
      expect(screen.getAllByRole("link", { name: "Уведомления, 2 непрочитанных" }).length).toBe(
        2, // сайдбар и колокольчик в шапке
      ),
    );
    expect(screen.getByRole("link", { name: "Ещё, 2 непрочитанных" })).toBeTruthy();

    fireEvent.click(screen.getByRole("link", { name: /Заявка на пересдачу на рассмотрении/ }));
    expect(router.state.location.pathname).toBe(
      paths.request(fixtures.notifications.items[0]?.link?.split("/").pop() ?? ""),
    );
    await waitFor(() =>
      expect(screen.getAllByRole("link", { name: "Уведомления, 1 непрочитанное" })).toHaveLength(2),
    );
  });

  it("«Прочитать все» — бейдж пропадает, фильтр «Непрочитанные» показывает «Всё прочитано»", async () => {
    renderAt(paths.notifications);
    await screen.findByRole("region", { name: "Вчера" });
    fireEvent.click(screen.getByRole("button", { name: "Прочитать все" }));
    await screen.findByText("Всё прочитано");
    expect(screen.queryByText("Новое")).toBeNull();
    expect(screen.queryByRole("button", { name: "Прочитать все" })).toBeNull();
    await waitFor(() =>
      expect(screen.getAllByRole("link", { name: "Уведомления" })).toHaveLength(2),
    );

    fireEvent.click(screen.getByRole("tab", { name: "Непрочитанные" }));
    expect(await screen.findByText("Новые уведомления появятся здесь.")).toBeTruthy();
  });

  it("фильтр «Непрочитанные» из адреса", async () => {
    renderAt(`${paths.notifications}?filter=unread`);
    await screen.findByRole("region", { name: "Вчера" });
    expect(screen.getAllByRole("listitem").filter((li) => li.closest("main"))).toHaveLength(2);
    expect(screen.getByRole("tab", { name: "Непрочитанные" }).getAttribute("aria-selected")).toBe(
      "true",
    );
  });

  it("фильтр дедлайнов из адреса сохраняет старые уведомления без срока", async () => {
    const legacy = {
      ...fixtures.notifications.items[2],
      id: crypto.randomUUID(),
      title: "Старый дедлайн без срока",
      dueDate: undefined,
    };
    server.use(
      http.get(routes.me.notifications.list.path, () =>
        HttpResponse.json({
          items: [...fixtures.notifications.items, legacy],
          unreadCount: 2,
        }),
      ),
    );
    renderAt(paths.notificationDeadlines);
    expect(await screen.findByText("до 30 ноября")).toBeTruthy();
    expect(screen.getByText("Старый дедлайн без срока")).toBeTruthy();
    expect(screen.queryByText("Хакатон AI High School")).toBeNull();
    expect(screen.getByRole("tab", { name: "Дедлайны" }).getAttribute("aria-selected")).toBe(
      "true",
    );
  });

  it("уведомление без ссылки отмечается кнопкой «Отметить прочитанным»", async () => {
    server.use(
      http.get(routes.me.notifications.list.path, () =>
        HttpResponse.json({
          unreadCount: 1,
          items: [{ ...fixtures.notifications.items[3], read: false }],
        }),
      ),
    );
    let marked = "";
    server.use(
      http.post(routes.me.notifications.markRead.path, ({ params }) => {
        marked = String(params.id);
        return undefined;
      }),
    );
    renderAt(paths.notifications);
    fireEvent.click(await screen.findByRole("button", { name: "Отметить прочитанным" }));
    await waitFor(() => expect(marked).toBe(fixtures.notifications.items[3]?.id));
  });

  it("пусто — «Уведомлений пока нет»; ошибка — «Повторить»", async () => {
    server.use(
      http.get(routes.me.notifications.list.path, () =>
        HttpResponse.json({ unreadCount: 0, items: [] }),
      ),
    );
    renderAt(paths.notifications);
    expect(await screen.findByText("Уведомлений пока нет")).toBeTruthy();
    cleanup();

    server.use(
      http.get(routes.me.notifications.list.path, () =>
        HttpResponse.json({ error: { code: "internal", message: "сбой" } }, { status: 500 }),
      ),
    );
    renderAt(paths.notifications);
    expect(await screen.findByRole("button", { name: "Повторить" })).toBeTruthy();
  });

  it("у сотрудника каркас не запрашивает студенческую ленту", async () => {
    let requested = false;
    server.use(
      http.get(routes.me.notifications.list.path, () => {
        requested = true;
        return undefined;
      }),
    );
    resetMockDb({ as: "staff" });
    renderAt(paths.staff, fixtures.me.staff);
    await screen.findByRole("heading", { name: "Кабинет сотрудника" });
    await new Promise((r) => setTimeout(r, 50));
    expect(requested).toBe(false);
    // Студенческой навигации у сотрудника нет: ни колокольчика, ни вкладок; выход — в шапке и меню.
    expect(screen.queryByRole("link", { name: /Уведомления/ })).toBeNull();
    expect(screen.queryByRole("link", { name: "Расписание" })).toBeNull();
    for (const name of ["Разделы", "Разделы сотрудника"]) {
      const navigation = within(screen.getByRole("navigation", { name }));
      expect(navigation.getByRole("link", { name: "Заявки студентов" })).toBeTruthy();
      expect(navigation.getByRole("link", { name: "Жалобы" })).toBeTruthy();
    }
    expect(screen.getAllByRole("button", { name: "Выйти" })).toHaveLength(2);
  });
});
