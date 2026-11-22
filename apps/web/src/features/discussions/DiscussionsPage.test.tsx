// @vitest-environment jsdom

import { routes } from "@aihs/contract";
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import { createQueryClient } from "../../api";
import { paths } from "../../app/paths";
import { routeTree } from "../../app/router";
import { handlers, resetMockDb } from "../../mocks/handlers";

const server = setupServer(...handlers);
beforeAll(() => server.listen());
beforeEach(() => resetMockDb({ as: "student" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

function open(path: string) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  const router = createMemoryRouter(routeTree, { initialEntries: [path] });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

it("переключает область, создаёт тему и сохраняет ответ при повторном открытии", async () => {
  const router = open(paths.discussions);
  expect(await screen.findByRole("link", { name: /Идеи для недели/ })).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: "Моя кафедра" }));
  expect(await screen.findByRole("link", { name: /Практикум по нейросетям/ })).toBeTruthy();
  expect(screen.queryByRole("link", { name: /Встреча клуба аналитиков/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Новая тема" }));
  fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }));
  expect(screen.getByLabelText("Заголовок").getAttribute("aria-invalid")).toBe("true");
  fireEvent.change(screen.getByLabelText("Заголовок"), { target: { value: "Учебная встреча" } });
  fireEvent.change(screen.getByLabelText("Текст темы"), { target: { value: "Выберем дату." } });
  fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }));
  expect(await screen.findByRole("heading", { name: "Учебная встреча", level: 1 })).toBeTruthy();
  expect(screen.getByText("Ответов пока нет.")).toBeTruthy();
  fireEvent.change(screen.getByRole("textbox", { name: "Ответ" }), {
    target: { value: "Подойдёт среда." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Отправить ответ" }));
  expect(await screen.findByText("Подойдёт среда.")).toBeTruthy();

  const path = router.state.location.pathname;
  cleanup();
  open(path);
  expect(await screen.findByText("Подойдёт среда.")).toBeTruthy();
  expect(screen.getByRole("link", { name: /К обсуждениям/ }).getAttribute("href")).toBe(
    "/discussions?scope=department",
  );
});

it("позволяет повторить запрос списка и показывает пустой результат", async () => {
  let attempts = 0;
  server.use(
    http.get(routes.me.discussions.list.path, () => {
      attempts++;
      return attempts === 1 ? HttpResponse.json({}, { status: 503 }) : HttpResponse.json([]);
    }),
  );
  open(paths.discussions);
  fireEvent.click(await screen.findByRole("button", { name: "Повторить" }));
  expect(await screen.findByText("Тем пока нет")).toBeTruthy();
});

it("показывает недоступность темы другой кафедры по прямой ссылке", async () => {
  open(paths.discussion("5e785af4-e7a5-4e3a-aeb4-2539b9c07b02"));
  expect(await screen.findByText("Тема недоступна")).toBeTruthy();
  expect(screen.queryByLabelText("Ответ")).toBeNull();
});

it("валидирует жалобу, сохраняет причину при сбое и подтверждает повторную отправку", async () => {
  const prototype = HTMLDialogElement.prototype;
  const original = Object.getOwnPropertyDescriptor(prototype, "showModal");
  Object.defineProperty(prototype, "showModal", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = true;
    },
  });
  try {
    const seen: unknown[] = [];
    server.use(
      http.post(routes.me.discussions.report.path, async ({ request, params }) => {
        seen.push({ commentId: params.commentId, input: await request.json() });
        return seen.length === 1
          ? HttpResponse.json({ error: { code: "internal", message: "Ошибка" } }, { status: 503 })
          : HttpResponse.json(
              { error: { code: "duplicate_report", message: "Уже отправлена" } },
              { status: 409 },
            );
      }),
    );
    open(paths.discussion("5e785af4-e7a5-4e3a-aeb4-2539b9c07b00"));
    fireEvent.click(await screen.findByRole("button", { name: "Действия с комментарием" }));
    fireEvent.click(screen.getByRole("button", { name: "Пожаловаться" }));
    const submit = screen.getByRole("button", { name: "Отправить жалобу" });
    fireEvent.click(submit);
    expect(screen.getByText("Укажите причину жалобы.")).toBeTruthy();
    expect(seen).toHaveLength(0);

    const input = screen.getByRole("textbox", { name: "Причина жалобы" }) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "  Проверьте этот текст.  " } });
    fireEvent.click(submit);
    expect(await screen.findByText(/На сервере что-то пошло не так/)).toBeTruthy();
    expect(input.value).toBe("  Проверьте этот текст.  ");
    fireEvent.click(submit);
    expect(await screen.findByText("Вы уже отправили жалобу на этот комментарий.")).toBeTruthy();
    expect(seen).toEqual(
      Array.from({ length: 2 }, () => ({
        commentId: "5e785af4-e7a5-4e3a-aeb4-2539b9c07b10",
        input: { reason: "Проверьте этот текст." },
      })),
    );
  } finally {
    if (original) Object.defineProperty(prototype, "showModal", original);
    else Reflect.deleteProperty(prototype, "showModal");
  }
});
