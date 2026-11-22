// @vitest-environment jsdom
import { fixtures, type Grades, routes } from "@aihs/contract";
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { MemoryRouter } from "react-router";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createQueryClient } from "../../api/hooks";
import { handlers, resetMockDb } from "../../mocks/handlers";
import { GradesPage } from "./GradesPage";
import { debtsNote } from "./model";
import { retakeLink } from "./PastDebts";

describe("пояснение к долгам в сводке", () => {
  it("нет прошлых — без пояснения; все прошлые; часть прошлых", () => {
    expect(debtsNote(1, 0)).toBeNull();
    expect(debtsNote(0, 0)).toBeNull();
    expect(debtsNote(1, 1)).toBe("с прошлых сессий");
    expect(debtsNote(3, 1)).toBe("из них 1 с прошлых сессий");
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

function open(grades?: Grades) {
  if (grades) server.use(http.get(routes.me.grades.path, () => HttpResponse.json(grades)));
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <GradesPage now={new Date("2026-11-19T09:00:00Z")} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("долги прошлых сессий", () => {
  it("блок в обзоре: семестр, предмет, баллы, итог и ссылка на пересдачу", async () => {
    const debt = fixtures.grades.pastDebts[0];
    if (!debt) throw new Error("нет прошлого долга в фикстуре");
    open();
    const block = await screen.findByRole("region", { name: "Долги прошлых сессий" });
    expect(within(block).getByText(debt.semester)).toBeTruthy();
    expect(within(block).getByRole("heading", { name: debt.subject })).toBeTruthy();
    expect(within(block).getByText(String(debt.totalPoints))).toBeTruthy();
    expect(within(block).getByText("Неудовлетворительно")).toBeTruthy();
    const link = within(block).getByRole("link", { name: /Подать на пересдачу/ });
    expect(link.getAttribute("href")).toBe(retakeLink(debt.subject));
    const href = new URL(retakeLink(debt.subject), "http://x");
    expect(href.pathname).toBe("/requests");
    expect(Object.fromEntries(href.searchParams)).toEqual({
      new: "1",
      type: "retake_application",
      comment: debt.subject,
    });

    expect(
      within(screen.getByRole("tabpanel", { name: "Обзор" })).getByRole("region", {
        name: "Долги прошлых сессий",
      }),
    ).toBe(block);

    // Сводка объясняет, что долг прошлый; калькулятор на месте.
    expect(screen.getByText("с прошлых сессий")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Что нужно набрать" })).toBeTruthy();
  });

  it("калькулятор: «Закрыть сессию» требует пересдать прошлый долг (#37)", async () => {
    const debt = fixtures.grades.pastDebts[0];
    if (!debt) throw new Error("нет прошлого долга в фикстуре");
    open();
    const card = (await screen.findByRole("heading", { name: "Что нужно набрать" })).closest(
      "section, div",
    ) as HTMLElement;
    fireEvent.click(within(card).getByRole("button", { name: "Закрыть сессию" }));
    expect(
      within(card).getByText(`Пересдать: ${debt.subject}, ${debt.semester.toLowerCase()}`),
    ).toBeTruthy();
    expect(within(card).getByText("Пересдача: от 30 из 40")).toBeTruthy();
    expect(within(card).getByRole("status").textContent).toMatch(/по 3 дисциплинам из 5/);
  });

  it("долгов нет — блока и пояснения нет", async () => {
    open({
      ...fixtures.grades,
      pastDebts: [],
      summary: { ...fixtures.grades.summary, debts: 0 },
    });
    expect(await screen.findByRole("heading", { name: "Как у меня дела" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Долги прошлых сессий" })).toBeNull();
    expect(screen.queryByText(/прошлых сессий/)).toBeNull();
  });
});
