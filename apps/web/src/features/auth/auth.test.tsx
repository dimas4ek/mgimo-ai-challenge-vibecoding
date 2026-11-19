// @vitest-environment jsdom

import { routes } from "@aihs/contract";
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ApiClientError } from "../../api/client";
import { createQueryClient } from "../../api/hooks";
import { safeNext } from "../../app/guards";
import { paths } from "../../app/paths";
import { routeTree } from "../../app/router";
import { handlers, resetMockDb } from "../../mocks/handlers";
import { loginErrorText } from "./LoginPage";

const server = setupServer(...handlers);
beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
  // В jsdom нет matchMedia, а переключатель темы в AppShell его читает.
  window.matchMedia ??= (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
beforeEach(() => resetMockDb());

function open(url: string) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  const router = createMemoryRouter(routeTree, { initialEntries: [url] });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const where = (router: ReturnType<typeof open>) =>
  router.state.location.pathname + router.state.location.search;

function fill(login: string, password: string) {
  fireEvent.change(screen.getByLabelText("Логин"), { target: { value: login } });
  fireEvent.change(screen.getByLabelText("Пароль"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Войти" }));
}

describe("охрана маршрутов", () => {
  it("без входа кабинет уводит на вход с возвратом", async () => {
    const router = open(paths.grades);
    await waitFor(() => expect(where(router)).toBe(`${paths.login}?next=%2Fgrades`));
    expect(await screen.findByRole("heading", { name: "Вход в кабинет" })).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Разделы" })).toBeNull();
  });

  it("студента не пускает в кабинет сотрудника", async () => {
    resetMockDb({ as: "student" });
    const router = open(paths.staff);
    await waitFor(() => expect(where(router)).toBe(paths.home));
  });

  it("сотрудника уводит из кабинета студента в свой", async () => {
    resetMockDb({ as: "staff" });
    const router = open(paths.schedule);
    await waitFor(() => expect(where(router)).toBe(paths.staff));
  });
});

describe("вход", () => {
  it("пустые поля — ошибки на месте, запрос не уходит", async () => {
    open(paths.login);
    fireEvent.click(await screen.findByRole("button", { name: "Войти" }));
    expect(await screen.findByText("Введите логин.")).toBeTruthy();
    expect(screen.getByText("Введите пароль.")).toBeTruthy();
    expect(screen.getByLabelText("Логин").getAttribute("aria-invalid")).toBe("true");
  });

  it("неверный пароль — общее сообщение, без уточнения", async () => {
    open(paths.login);
    await screen.findByRole("button", { name: "Войти" });
    fill("student", "wrong");
    expect(await screen.findByText("Неверный логин или пароль.")).toBeTruthy();
  });

  it("успех: возвращает на запрошенную страницу", async () => {
    const router = open(`${paths.login}?next=%2Fgrades`);
    await screen.findByRole("button", { name: "Войти" });
    fill("student", "demo");
    await waitFor(() => expect(where(router)).toBe(paths.grades));
  });

  it("сотрудник после входа попадает в свой кабинет", async () => {
    const router = open(paths.login);
    await screen.findByRole("button", { name: "Войти" });
    fill("staff", "demo");
    await waitFor(() => expect(where(router)).toBe(paths.staff));
  });

  it("пока идёт запрос, кнопка заблокирована", async () => {
    server.use(http.post(routes.auth.login.path, () => new Promise<Response>(() => {})));
    open(paths.login);
    await screen.findByRole("button", { name: "Войти" });
    fill("student", "demo");
    const button = await screen.findByRole("button", { name: "Входим…" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it("тексты ошибок: 401, 429, сеть", () => {
    expect(loginErrorText(new ApiClientError(401, "unauthorized", "x"))).toMatch(/Неверный/);
    expect(loginErrorText(new ApiClientError(429, "rate_limited", "x"))).toMatch(/попыток/);
    expect(loginErrorText(new TypeError("fetch failed"))).toMatch(/интернет/);
  });

  it("safeNext не пускает на чужие сайты и на сам вход", () => {
    expect(safeNext("/grades?x=1")).toBe("/grades?x=1");
    expect(safeNext("//evil.example")).toBeNull();
    expect(safeNext("/\\evil.example")).toBeNull();
    expect(safeNext("https://evil.example")).toBeNull();
    expect(safeNext(paths.login)).toBeNull();
    expect(safeNext(null)).toBeNull();
  });
});

describe("профиль и выход", () => {
  it("показывает данные студента; «Выйти» ведёт на вход и закрывает кабинет", async () => {
    resetMockDb({ as: "student" });
    const router = open(paths.profile);
    expect(await screen.findByText("Лебедянская Мирослава Игоревна")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Выйти" }));
    await waitFor(() => expect(where(router)).toBe(paths.login));
    await router.navigate(paths.profile);
    await waitFor(() => expect(where(router)).toBe(`${paths.login}?next=%2Fprofile`));
  });

  it("ошибка загрузки профиля — сообщение и «Повторить»", async () => {
    resetMockDb({ as: "student" });
    server.use(http.get(routes.me.profile.path, () => HttpResponse.json({}, { status: 500 })));
    open(paths.profile);
    expect(await screen.findByRole("button", { name: "Повторить" })).toBeTruthy();
  });
});
