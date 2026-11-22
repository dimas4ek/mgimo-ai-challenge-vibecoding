// @vitest-environment jsdom
import { type DisciplineGrade, fixtures, routes } from "@aihs/contract";
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { MemoryRouter } from "react-router";
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
  exam: null,
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

/**
 * Вариант с долгом в текущем семестре: на нём проверяются порядок «долг первым» и калькулятор
 * с пересдачей. В фикстуре контракта долг прошлый (`pastDebts`).
 */
const withCurrentDebt = {
  ...fixtures.grades,
  disciplines: fixtures.grades.disciplines.map((d) =>
    d.subject.startsWith("Теория вероятностей")
      ? {
          ...d,
          subject: "Теория вероятностей и статистика",
          examPoints: 15,
          totalPoints: 37,
          result: "unsatisfactory" as const,
        }
      : d,
  ),
  pastDebts: [],
  summary: { averagePoints: 63.25, disciplinesTotal: 4, disciplinesPassed: 2, debts: 1 },
};
const useCurrentDebt = () =>
  server.use(http.get(routes.me.grades.path, () => HttpResponse.json(withCurrentDebt)));

function open(path = "/grades") {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <GradesPage now={NOW} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("экран успеваемости", () => {
  it("загрузка — скелет со статусом для скринридера", () => {
    open();
    expect(screen.getByRole("status").textContent).toContain("Загружаем оценки");
  });

  it("в обзоре есть сводка, сессия и долги текущего семестра", async () => {
    useCurrentDebt();
    open();
    expect(await screen.findByRole("heading", { name: "Как у меня дела" })).toBeTruthy();
    // Средний балл включает дисциплины без итога — подпись это поясняет.
    expect(screen.getByText(/средний балл из 100 по текущим баллам/)).toBeTruthy();
    expect(screen.getByText(fixtures.grades.semester)).toBeTruthy();
    expect(screen.getByText("63,3")).toBeTruthy();
    expect(screen.getByText("2 из 4")).toBeTruthy();
    expect(screen.getByText(/28 декабря – 24 января/).textContent).toContain("через 39 дней");

    const section = screen.getByRole("region", { name: "Долги текущего семестра" });
    const cards = within(section).getAllByRole("heading", { level: 3 });
    expect(cards[0]?.textContent).toBe("Теория вероятностей и статистика");
    expect(screen.getByText("Неудовлетворительно")).toBeTruthy();
  });

  it("вкладка открывает дисциплины, выбор семестра сохраняет доступ к прошлым оценкам", async () => {
    open();
    fireEvent.click(screen.getByRole("tab", { name: "Дисциплины" }));
    const select = await screen.findByRole<HTMLSelectElement>("combobox", { name: "Семестр" });
    expect(select.selectedOptions[0]?.textContent).toBe(fixtures.grades.semester);
    expect(screen.queryByRole("heading", { name: "Как у меня дела" })).toBeNull();

    fireEvent.change(select, { target: { value: select.options[1]?.value } });
    const debt = fixtures.grades.pastDebts[0];
    expect(debt).toBeDefined();
    if (!debt) throw new Error("Нет демодолга");
    fireEvent.click(screen.getByRole("link", { name: new RegExp(debt.subject) }));
    expect(await screen.findByRole("heading", { name: debt.subject })).toBeTruthy();
    expect(screen.getByText("Форма контроля")).toBeTruthy();
    expect(screen.getByText("Всего часов")).toBeTruthy();
    expect(screen.getByText("Неудовлетворительно")).toBeTruthy();

    fireEvent.click(screen.getByRole("link", { name: "Все дисциплины" }));
    expect(screen.getByRole<HTMLSelectElement>("combobox").selectedOptions[0]?.textContent).toBe(
      debt.semester,
    );
  });

  it("ссылка из расписания сразу открывает нужную карточку", async () => {
    const [subject] = fixtures.grades.disciplines;
    if (!subject) throw new Error("Нет демодисциплины");
    open(`/grades?tab=disciplines&subject=${subject.id}`);
    expect(await screen.findByRole("heading", { name: subject.subject })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Дисциплины", selected: true })).toBeTruthy();
  });

  it("калькулятор: по умолчанию достижимая цель, переключение показывает правило и итог", async () => {
    useCurrentDebt();
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
