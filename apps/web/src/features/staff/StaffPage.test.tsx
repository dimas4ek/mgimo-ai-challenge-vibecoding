// @vitest-environment jsdom
import { fixtures, routes } from "@aihs/contract";
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createQueryClient, queryKeys } from "../../api";
import { paths } from "../../app/paths";
import { handlers, resetMockDb } from "../../mocks/handlers";
import { StaffPage } from "./StaffPage";

// Фикстуры: справка о стипендии (подана), пересдача (на рассмотрении), справка об обучении (готова).
const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
beforeEach(() => resetMockDb({ as: "staff" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

function renderAt(url: string) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  client.setQueryData(queryKeys.me, fixtures.me.staff);
  const router = createMemoryRouter([{ path: paths.staff, element: <StaffPage /> }], {
    initialEntries: [url],
  });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const submitted = fixtures.requests.find((r) => r.status === "submitted");
const ready = fixtures.requests.find((r) => r.status === "ready");
if (!submitted || !ready) throw new Error("нет нужных заявок в фикстурах");

/** Список очереди (без фильтров). */
const queue = () => {
  const list = screen.getAllByRole("list")[0];
  if (!list) throw new Error("нет очереди");
  return list;
};

describe("StaffPage", () => {
  it("по умолчанию — новые заявки с ФИО и группой студента; фильтр отмечен", async () => {
    renderAt(paths.staff);
    expect(screen.getByRole("status").textContent).toBe("Загружаем заявки…");
    const link = await screen.findByRole("link", { name: /Справка о стипендии/ });
    expect(link.textContent).toContain("Подана");
    expect(link.textContent).toContain("ПИИ-301");
    expect(within(queue()).getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Новые" }).getAttribute("aria-current")).toBe("page");
  });

  it("фильтр «Все» — вся очередь, активные сверху", async () => {
    const router = renderAt(paths.staff);
    await screen.findByRole("link", { name: /Справка о стипендии/ });
    fireEvent.click(screen.getByRole("link", { name: "Все" }));
    expect(router.state.location.search).toBe("?status=all");
    await screen.findByRole("link", { name: /Справка об обучении/ });
    const titles = within(queue())
      .getAllByRole("listitem")
      .map(
        (li) =>
          li.textContent?.match(
            /Справка о стипендии|Заявление на пересдачу|Справка об обучении/,
          )?.[0],
      );
    expect(titles).toEqual([
      "Заявление на пересдачу",
      "Справка о стипендии",
      "Справка об обучении",
    ]);
  });

  it("отказ без причины — ошибка на месте; с причиной — статус меняется, карточка остаётся", async () => {
    const router = renderAt(paths.staff);
    fireEvent.click(await screen.findByRole("link", { name: /Справка о стипендии/ }));
    expect(router.state.location.search).toBe(`?id=${submitted.id}`);
    const card = await screen.findByRole("region", { name: "Справка о стипендии" });
    expect(within(card).getByText("Лебедянская Мирослава Игоревна")).toBeTruthy();

    fireEvent.click(within(card).getByRole("button", { name: "Отклонить" }));
    const field = within(card).getByRole("textbox", { name: "Комментарий для студента" });
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(within(card).getByRole("alert").textContent).toMatch(/причину/);

    fireEvent.change(field, { target: { value: "Справка уже выдана в этом месяце" } });
    fireEvent.click(within(card).getByRole("button", { name: "Отклонить" }));
    expect(await within(card).findByText(/Статус изменён на «Отклонена»/)).toBeTruthy();
    expect(within(card).getByText("Заявка закрыта — статус больше не меняется.")).toBeTruthy();
    expect(within(card).getByText("Справка уже выдана в этом месяце")).toBeTruthy();
    // Из очереди «Новые» заявка ушла.
    expect(await screen.findByText("Новых заявок нет")).toBeTruthy();
  });

  it("во время сохранения кнопки заблокированы", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post(routes.staff.requests.changeStatus.path, async () => {
        await gate;
        return undefined;
      }),
    );
    renderAt(`${paths.staff}?id=${submitted.id}`);
    const card = await screen.findByRole("region", { name: "Справка о стипендии" });
    fireEvent.click(within(card).getByRole("button", { name: "Взять в работу" }));
    const saving = await within(card).findByRole("button", { name: "Сохраняем…" });
    expect((saving as HTMLButtonElement).disabled).toBe(true);
    expect(
      (within(card).getByRole("button", { name: "Готово" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    release();
    expect(await within(card).findByText(/Статус изменён на «На рассмотрении»/)).toBeTruthy();
  });

  it("готовая заявка — без кнопок смены статуса", async () => {
    renderAt(`${paths.staff}?status=ready&id=${ready.id}`);
    const card = await screen.findByRole("region", { name: "Справка об обучении" });
    expect(within(card).getByText("Заявка закрыта — статус больше не меняется.")).toBeTruthy();
    expect(within(card).queryByRole("button")).toBeNull();
    const history = within(card).getByRole("region", { name: "История" });
    expect(history.textContent).toContain("Комментарий: Можно забрать в деканате, каб. 112");
  });

  it("неизвестная заявка — «Заявка не найдена»", async () => {
    renderAt(`${paths.staff}?id=${crypto.randomUUID()}`);
    expect(await screen.findByText("Заявка не найдена")).toBeTruthy();
  });

  it("пустая очередь и ошибка загрузки", async () => {
    server.use(http.get(routes.staff.requests.list.path, () => HttpResponse.json([])));
    renderAt(paths.staff);
    expect(await screen.findByText("Новых заявок нет")).toBeTruthy();
    cleanup();

    server.use(
      http.get(routes.staff.requests.list.path, () =>
        HttpResponse.json({ error: { code: "internal", message: "сбой" } }, { status: 500 }),
      ),
    );
    renderAt(paths.staff);
    expect(await screen.findByRole("button", { name: "Повторить" })).toBeTruthy();
  });
});
