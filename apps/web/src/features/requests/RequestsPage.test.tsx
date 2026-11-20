// @vitest-environment jsdom
import { fixtures, routes } from "@aihs/contract";
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { delay, HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createQueryClient } from "../../api";
import { paths } from "../../app/paths";
import { handlers, resetMockDb } from "../../mocks/handlers";
import { retakeLink } from "../grades/PastDebts";
import { RequestPage } from "./RequestPage";
import { RequestsPage } from "./RequestsPage";

// Фикстуры: справка об обучении (готова), пересдача (на рассмотрении), справка о стипендии (подана).
const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
beforeEach(() => resetMockDb({ as: "student" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

function renderAt(url: string) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  const router = createMemoryRouter(
    [
      { path: paths.requests, element: <RequestsPage /> },
      { path: paths.requestPattern, element: <RequestPage /> },
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

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));

describe("RequestsPage", () => {
  it("скелетон, затем список: активные сверху, статус — текстом с иконкой", async () => {
    renderAt(paths.requests);
    expect(screen.getByRole("status").textContent).toBe("Загружаем заявки…");
    const links = await screen.findAllByRole("link");
    expect(links.map((l) => l.textContent?.split(/Подана|На рассмотрении|Готова/)[0])).toEqual([
      "Справка о стипендии",
      "Заявление на пересдачу",
      "Справка об обучении",
    ]);
    const ready = within(links[2] as HTMLElement).getByText("Готова");
    expect(ready.querySelector("svg")).not.toBeNull();
  });

  it("пустой список — «Заявок пока нет» и кнопка заказать справку открывает мастер", async () => {
    server.use(http.get(routes.me.requests.list.path, () => HttpResponse.json([])));
    const router = renderAt(paths.requests);
    await screen.findByText("Заявок пока нет");
    click("Заказать справку");
    expect(router.state.location.search).toBe("?new=1");
    expect(screen.getByRole("heading", { name: /Шаг 1 из 3/ })).toBeTruthy();
  });

  it("ошибка загрузки — сообщение и «Повторить»", async () => {
    server.use(
      http.get(routes.me.requests.list.path, () =>
        HttpResponse.json({ error: { code: "internal", message: "сбой" } }, { status: 500 }),
      ),
    );
    renderAt(paths.requests);
    expect(await screen.findByRole("button", { name: "Повторить" })).toBeTruthy();
    // Сервер ответил 500 — интернет ни при чём.
    const alert = screen.getByRole("alert").textContent ?? "";
    expect(alert).not.toMatch(/интернет/);
    expect(alert).toMatch(/сервер/i);
  });

  it("мастер: без выбора — ошибка; заявлению нужно пояснение; отправка блокирует кнопку и открывает карточку", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post(routes.me.requests.create.path, async () => {
        await gate;
        return undefined; // дальше — обычный хендлер моков
      }),
    );
    const router = renderAt(`${paths.requests}?new=1`);

    click("Далее");
    expect(screen.getByRole("alert").textContent).toBe("Выберите, что нужно оформить");

    fireEvent.click(screen.getByRole("radio", { name: /Заявление на пересдачу/ }));
    click("Далее");
    expect(screen.getByRole("heading", { name: /Шаг 2 из 3/ })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: /Шаг 2 из 3/ }));

    click("Далее");
    const field = screen.getByRole("textbox", { name: "Дисциплина и причина" });
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").textContent).toMatch(/Опишите/);

    fireEvent.change(field, { target: { value: "  Линейная алгебра, болел  " } });
    expect(field.getAttribute("aria-invalid")).toBeNull();
    click("Далее");
    expect(screen.getByText("Линейная алгебра, болел")).toBeTruthy();

    click("Отправить");
    const sending = await screen.findByRole("button", { name: "Отправляем…" });
    expect((sending as HTMLButtonElement).disabled).toBe(true);
    release();

    expect(await screen.findByText("Заявка отправлена.")).toBeTruthy();
    expect(router.state.location.pathname).toMatch(/^\/requests\/[0-9a-f-]{36}$/);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Заявление на пересдачу");
    expect(screen.getByText("Линейная алгебра, болел")).toBeTruthy();
  });

  it("справку можно отправить без пояснения; тип из адреса выбран заранее", async () => {
    renderAt(`${paths.requests}?new=1&type=transcript`);
    expect(
      (screen.getByRole("radio", { name: /Выписка с оценками/ }) as HTMLInputElement).checked,
    ).toBe(true);
    click("Далее");
    click("Далее");
    expect(screen.getByText("Не указано")).toBeTruthy();
    click("Отправить");
    expect(await screen.findByText("Заявка отправлена.")).toBeTruthy();
  });

  it("двойной клик по «Отправить» создаёт одну заявку", async () => {
    let posts = 0;
    server.use(
      http.post(routes.me.requests.create.path, () => {
        posts += 1;
        return undefined; // дальше — обычный хендлер моков
      }),
    );
    renderAt(`${paths.requests}?new=1&type=transcript`);
    click("Далее");
    click("Далее");
    const send = screen.getByRole("button", { name: "Отправить" });
    fireEvent.click(send);
    fireEvent.click(send);
    expect(await screen.findByText("Заявка отправлена.")).toBeTruthy();
    expect(posts).toBe(1);
  });

  it("сбой отправки — понятная ошибка, мастер остаётся открытым, можно отправить снова", async () => {
    let posts = 0;
    server.use(
      http.post(routes.me.requests.create.path, async () => {
        posts += 1;
        await delay(10);
        return HttpResponse.json({ error: { code: "internal", message: "сбой" } }, { status: 500 });
      }),
    );
    renderAt(`${paths.requests}?new=1&type=transcript`);
    click("Далее");
    click("Далее");
    click("Отправить");
    expect((await screen.findByRole("alert")).textContent).toMatch(/Не получилось отправить/);
    click("Отправить");
    await screen.findByRole("button", { name: "Отправляем…" });
    await screen.findByRole("button", { name: "Отправить" });
    expect(posts).toBe(2);
  });

  it("ссылка от долга: тип «пересдача» выбран, пояснение заполнено дисциплиной; «Отмена» чистит адрес", async () => {
    const router = renderAt(retakeLink("Теория вероятностей и статистика, ч. 1"));
    expect(
      (screen.getByRole("radio", { name: /Заявление на пересдачу/ }) as HTMLInputElement).checked,
    ).toBe(true);
    click("Далее");
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
      "Теория вероятностей и статистика, ч. 1",
    );
    click("Назад");
    click("Отмена");
    expect(router.state.location.search).toBe("");
  });

  it("слишком длинный comment в адресе не подставляется; без comment пояснение пустое", async () => {
    const long = new URLSearchParams({ comment: "а".repeat(1001) });
    renderAt(`${paths.requests}?new=1&type=retake_application&${long}`);
    click("Далее");
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
    cleanup();
    renderAt(`${paths.requests}?new=1&type=retake_application`);
    click("Далее");
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
  });

  it("«Отмена» закрывает мастер и возвращает список", async () => {
    const router = renderAt(`${paths.requests}?new=1`);
    click("Отмена");
    expect(router.state.location.search).toBe("");
    expect(await screen.findAllByRole("link")).toHaveLength(3);
  });
});

describe("RequestPage", () => {
  const ready = fixtures.requests.find((r) => r.status === "ready");

  it("история по времени с комментарием деканата и ссылка на справку для печати", async () => {
    if (!ready) throw new Error("нет готовой заявки в фикстурах");
    renderAt(paths.request(ready.id));
    const history = await screen.findByRole("region", { name: "История" });
    const steps = within(history).getAllByRole("listitem");
    expect(steps.map((s) => s.textContent?.match(/Подана|На рассмотрении|Готова/)?.[0])).toEqual([
      "Подана",
      "На рассмотрении",
      "Готова",
    ]);
    expect(steps[2]?.textContent).toContain("Деканат: Можно забрать в деканате, каб. 112");
    expect(screen.getByRole("link", { name: "Справка для печати" }).getAttribute("href")).toBe(
      paths.certificate(ready.id),
    );
  });

  it("заявление на рассмотрении — без ссылки на печать", async () => {
    const inReview = fixtures.requests.find((r) => r.status === "in_review");
    if (!inReview) throw new Error("нет заявки на рассмотрении в фикстурах");
    renderAt(paths.request(inReview.id));
    await screen.findByRole("heading", { level: 1, name: "Заявление на пересдачу" });
    expect(screen.queryByRole("link", { name: "Справка для печати" })).toBeNull();
  });

  it("чужая или несуществующая заявка — «Заявка не найдена»", async () => {
    renderAt(paths.request(crypto.randomUUID()));
    expect(await screen.findByText("Заявка не найдена", { selector: "p" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "К списку заявок" })).toBeTruthy();
  });
});
