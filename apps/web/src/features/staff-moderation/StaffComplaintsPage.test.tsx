// @vitest-environment jsdom

import { routes } from "@aihs/contract";
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import { call } from "../../api/client";
import { createQueryClient } from "../../api/hooks";
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

const topicId = "5e785af4-e7a5-4e3a-aeb4-2539b9c07b00";
const commentId = "5e785af4-e7a5-4e3a-aeb4-2539b9c07b10";
const original = "Можем показать, как визуализируем расписание.";
const reason = "Проверьте этот комментарий.";

function open(path: string) {
  const cache = createQueryClient();
  cache.setDefaultOptions({ queries: { retry: false } });
  const router = createMemoryRouter(routeTree, { initialEntries: [path] });
  render(
    <QueryClientProvider client={cache}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const login = (login: "student" | "staff") =>
  call(routes.auth.login, { body: { login, password: "demo" } });

it.each([
  { action: "Скрыть комментарий", status: "Комментарий скрыт", studentBody: null },
  { action: "Отклонить жалобу", status: "Жалоба отклонена", studentBody: original },
])(
  "$action обновляет карточку, очередь и студенческое обсуждение",
  async ({ action, status, studentBody }) => {
    const receipt = await call(routes.me.discussions.report, {
      body: { reason },
      params: { commentId },
    });
    await login("staff");
    const router = open(paths.staffComplaints);
    fireEvent.click(await screen.findByRole("link", { name: /Проверьте этот комментарий/ }));
    expect(await screen.findByText(original)).toBeTruthy();
    expect(screen.getByText(reason)).toBeTruthy();
    expect(router.state.location.pathname).toBe(paths.staffComplaint(receipt.id));
    fireEvent.click(screen.getByRole("button", { name: action }));
    expect(await screen.findByText(status)).toBeTruthy();
    expect(screen.queryByRole("button", { name: action })).toBeNull();
    fireEvent.click(screen.getByRole("link", { name: "К жалобам" }));
    expect(await screen.findByRole("link", { name: new RegExp(status) })).toBeTruthy();

    await login("student");
    const topic = await call(routes.me.discussions.get, { params: { id: topicId } });
    expect(topic.comments.find((comment) => comment.id === commentId)?.body).toBe(studentBody);
  },
);

it("отправляет студента на главную с прямой ссылки на жалобу", async () => {
  let requests = 0;
  server.use(
    http.get(routes.staff.discussionReports.get.path, () => {
      requests++;
      return HttpResponse.json({}, { status: 403 });
    }),
  );
  const router = open(paths.staffComplaint(commentId));
  expect(await screen.findByRole("heading", { name: "Сегодня" })).toBeTruthy();
  expect(router.state.location.pathname).toBe(paths.home);
  expect(screen.queryByRole("link", { name: "Жалобы" })).toBeNull();
  expect(requests).toBe(0);
});

it("показывает ошибку очереди, повтор и пустое состояние", async () => {
  await login("staff");
  let attempts = 0;
  server.use(
    http.get(routes.staff.discussionReports.list.path, () => {
      attempts++;
      return attempts === 1 ? HttpResponse.json({}, { status: 503 }) : HttpResponse.json([]);
    }),
  );
  open(paths.staffComplaints);
  fireEvent.click(await screen.findByRole("button", { name: "Повторить" }));
  expect(await screen.findByText("Жалоб пока нет")).toBeTruthy();
});
