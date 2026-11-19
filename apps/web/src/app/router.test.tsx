import { fixtures, type Me } from "@aihs/contract";
import { QueryClientProvider } from "@tanstack/react-query";
import { renderToString } from "react-dom/server";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { createQueryClient, queryKeys } from "../api/hooks";
import { paths } from "./paths";
import { routeTree } from "./router";

/** Рендер адреса от имени пользователя: по умолчанию студент, для /staff — сотрудник. */
function renderAt(
  url: string,
  me: Me | null = url === paths.staff ? fixtures.me.staff : fixtures.me.student,
) {
  const client = createQueryClient();
  client.setQueryData(queryKeys.me, me);
  const router = createMemoryRouter(routeTree, { initialEntries: [url] });
  return renderToString(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

const h1 = (html: string) => [...html.matchAll(/<h1[^>]*>(.*?)<\/h1>/g)].map((m) => m[1]);

/** Страницы внутри AppShell: адрес → заголовок. */
const shellPages: [string, string][] = [
  [paths.home, "Сегодня"],
  [paths.schedule, "Расписание"],
  [paths.grades, "Успеваемость"],
  [paths.requests, "Заявки и справки"],
  [paths.request("9a8b7c6d-5e4f-4a3b-9c2d-1e0f2a3b4c01"), "Заявка"],
  [paths.notifications, "Уведомления"],
  [paths.profile, "Профиль"],
  [paths.more, "Ещё"],
  [paths.staff, "Заявки студентов"],
  ["/no-such-page", "Страница не найдена"],
];

/** Страницы без AppShell: вход, проверка справки, печатная форма. */
const barePages: [string, string][] = [
  [paths.login, "Вход"],
  [paths.verify("tok"), "Проверка справки"],
  [paths.certificate("9a8b7c6d-5e4f-4a3b-9c2d-1e0f2a3b4c01"), "Справка"],
];

describe("роутер", () => {
  it.each(shellPages)("%s — внутри AppShell, один h1 «%s»", (url, title) => {
    const html = renderAt(url);
    expect(h1(html)).toEqual([title]);
    expect(html.match(/<main/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Разделы"');
    expect(html).toContain("не официальный сервис");
  });

  it.each(barePages)("%s — без AppShell, один h1 «%s», дисклеймер на месте", (url, title) => {
    const html = renderAt(url, null);
    expect(h1(html)).toEqual([title]);
    expect(html).not.toContain('aria-label="Разделы"');
    expect(html).toContain("не официальный сервис");
  });

  it("таб-бар: пять вкладок, «Успеваемость» коротко «Оценки»", () => {
    const html = renderAt(paths.home);
    for (const label of ["Главная", "Расписание", "Оценки", "Заявки", "Ещё"]) {
      expect(html).toContain(`>${label}</span>`);
    }
  });

  it("«Ещё» подсвечена на профиле", () => {
    const html = renderAt(paths.profile);
    const more = html.match(/<a[^>]*href="\/more"[^>]*>/)?.[0] ?? "";
    expect(more).toContain("text-primary");
  });
});

describe("paths", () => {
  it("кодирует параметры", () => {
    expect(paths.request("a/b")).toBe("/requests/a%2Fb");
    expect(paths.verify("x y")).toBe("/verify/x%20y");
    expect(paths.certificate("1")).toBe("/requests/1/certificate");
  });
});
