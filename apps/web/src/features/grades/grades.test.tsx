// @vitest-environment jsdom
import { type DisciplineGrade, fixtures, routes } from "@aihs/contract";
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createQueryClient } from "../../api/hooks";
import { handlers, resetMockDb } from "../../mocks/handlers";
import { GradesPage } from "./GradesPage";
import {
  controlFormLabel,
  disciplineState,
  formatSessionRange,
  pluralDays,
  resultLabel,
  sessionPhase,
  sortForDisplay,
} from "./model";

const discipline = (over: Partial<DisciplineGrade>): DisciplineGrade => ({
  id: "00000000-0000-4000-8000-000000000000",
  subject: "Предмет",
  teacher: "Преподаватель",
  controlForm: "exam",
  credits: 3,
  semesterPoints: 40,
  examPoints: null,
  totalPoints: 40,
  result: "pending",
  ...over,
});

describe("модель успеваемости", () => {
  it("подписи формы контроля и итога", () => {
    expect(controlFormLabel("graded_credit")).toBe("Дифф. зачёт");
    expect(resultLabel("failed")).toEqual({ label: "Не зачтено", tone: "danger" });
    expect(resultLabel("pending").tone).toBe("neutral");
  });

  it("состояние дисциплины и порядок: долги, без итога, закрытые; внутри по алфавиту", () => {
    expect(disciplineState(discipline({ result: "unsatisfactory" }))).toBe("debt");
    expect(disciplineState(discipline({ result: "satisfactory" }))).toBe("passed");
    expect(disciplineState(discipline({ result: "pending" }))).toBe("pending");
    const sorted = sortForDisplay([
      discipline({ subject: "Б", result: "passed" }),
      discipline({ subject: "В", result: "pending" }),
      discipline({ subject: "Я", result: "failed" }),
      discipline({ subject: "А", result: "good" }),
    ]).map((d) => d.subject);
    expect(sorted).toEqual(["Я", "В", "А", "Б"]);
  });

  it("сроки сессии: разные месяцы и один месяц", () => {
    expect(formatSessionRange({ startDate: "2026-12-28", endDate: "2027-01-24" })).toBe(
      "28 декабря – 24 января",
    );
    expect(formatSessionRange({ startDate: "2027-06-08", endDate: "2027-06-30" })).toBe(
      "8–30 июня",
    );
  });

  it("фаза сессии считается по Москве, а не по часам устройства", () => {
    const session = { startDate: "2026-12-28", endDate: "2027-01-24" };
    // 23:30 UTC 27.12 — в Москве уже 28.12, сессия идёт.
    expect(sessionPhase(session, new Date("2026-12-27T23:30:00Z"))).toEqual({ phase: "ongoing" });
    expect(sessionPhase(session, new Date("2026-12-27T20:00:00Z"))).toEqual({
      phase: "before",
      daysLeft: 1,
    });
    expect(sessionPhase(session, new Date("2026-11-19T09:00:00Z"))).toEqual({
      phase: "before",
      daysLeft: 39,
    });
    expect(sessionPhase(session, new Date("2027-01-24T20:00:00Z"))).toEqual({ phase: "ongoing" });
    expect(sessionPhase(session, new Date("2027-01-24T21:30:00Z"))).toEqual({ phase: "after" });
  });

  it.each([
    [1, "1 день"],
    [2, "2 дня"],
    [5, "5 дней"],
    [11, "11 дней"],
    [14, "14 дней"],
    [21, "21 день"],
    [22, "22 дня"],
    [39, "39 дней"],
    [101, "101 день"],
    [112, "112 дней"],
  ])("pluralDays(%i) → «%s»", (n, text) => {
    expect(pluralDays(n)).toBe(text);
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

const NOW = new Date("2026-11-19T09:00:00Z");

function open() {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  render(
    <QueryClientProvider client={client}>
      <GradesPage now={NOW} />
    </QueryClientProvider>,
  );
}

describe("экран успеваемости", () => {
  it("загрузка — скелет со статусом для скринридера", () => {
    open();
    expect(screen.getByRole("status").textContent).toContain("Загружаем оценки");
  });

  it("сводка сверху, сессия, долг первым и подписан текстом", async () => {
    open();
    expect(await screen.findByRole("heading", { name: "Как у меня дела" })).toBeTruthy();
    expect(screen.getByText(fixtures.grades.semester)).toBeTruthy();
    expect(screen.getByText("63,3")).toBeTruthy();
    expect(screen.getByText("2 из 4")).toBeTruthy();
    expect(screen.getByText(/28 декабря – 24 января/).textContent).toContain("через 39 дней");

    const section = screen.getByRole("region", { name: "Дисциплины" });
    const cards = within(section).getAllByRole("heading", { level: 3 });
    expect(cards[0]?.textContent).toBe("Теория вероятностей и статистика");
    expect(screen.getByText("Неудовлетворительно")).toBeTruthy();
    expect(screen.getByText("ещё не сдан")).toBeTruthy();
  });

  it("калькулятор: по умолчанию достижимая цель, переключение показывает правило и итог", async () => {
    open();
    expect(await screen.findByRole("heading", { name: "Что нужно набрать" })).toBeTruthy();
    // Стипендия и повышенная недостижимы из-за долга — выбрана «Закрыть сессию».
    const close = screen.getByRole("button", { name: "Закрыть сессию" });
    expect(close.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText(/баллы нужны ещё по 2 дисциплинам из 4/)).toBeTruthy();
    expect(screen.getByText("от 3 из 40")).toBeTruthy();
    expect(screen.getByText("Пересдача: от 33 из 40")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Стипендия" }));
    expect(screen.getByText(/не ниже 70 баллов/)).toBeTruthy();
    expect(screen.getByText(/уже не получится/)).toBeTruthy();
    expect(screen.getByText("от 18 из 40")).toBeTruthy();
    expect(screen.getByText("Долг: нужна пересдача")).toBeTruthy();
  });

  it("оценок нет — пустое состояние", async () => {
    server.use(
      http.get(routes.me.grades.path, () =>
        HttpResponse.json({
          ...fixtures.grades,
          disciplines: [],
          summary: { averagePoints: 0, disciplinesTotal: 0, disciplinesPassed: 0, debts: 0 },
        }),
      ),
    );
    open();
    expect(await screen.findByText("Оценок пока нет")).toBeTruthy();
  });

  it("ошибка — сообщение и «Повторить»", async () => {
    server.use(http.get(routes.me.grades.path, () => HttpResponse.json({}, { status: 500 })));
    open();
    expect(await screen.findByRole("button", { name: "Повторить" })).toBeTruthy();
  });
});
