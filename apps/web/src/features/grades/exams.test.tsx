// @vitest-environment jsdom
import { type DisciplineGrade, fixtures, type Grades, routes } from "@aihs/contract";
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { MemoryRouter } from "react-router";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createQueryClient } from "../../api/hooks";
import { handlers, resetMockDb } from "../../mocks/handlers";
import { GradesPage } from "./GradesPage";
import { examLine, formatExamSlot, nextExam, whenLabel } from "./model";

const d = (subject: string, exam: DisciplineGrade["exam"]): DisciplineGrade => ({
  id: "00000000-0000-4000-8000-000000000000",
  subject,
  teacher: "Преподаватель",
  controlForm: "exam",
  credits: 3,
  semesterPoints: 40,
  examPoints: null,
  totalPoints: 40,
  result: "pending",
  exam,
});

describe("даты экзаменов: модель", () => {
  it("подпись даты, формы контроля и аудитории; без даты — «пока не назначена»", () => {
    expect(formatExamSlot({ date: "2027-01-12", start: "10:00", room: "А-214" })).toBe(
      "12 января, 10:00, ауд. А-214",
    );
    expect(
      examLine({
        controlForm: "credit",
        exam: { date: "2026-12-25", start: "14:30", room: "Б-108" },
      }),
    ).toBe("Зачёт 25 декабря, 14:30, ауд. Б-108");
    expect(examLine({ controlForm: "exam", exam: null })).toBe("Дата пока не назначена");
  });

  it("ближайший: прошедшие пропускаются, время и «сегодня» — по Москве, а не по устройству", () => {
    const list = [
      d("прошёл", { date: "2026-11-14", start: "12:00", room: "1" }),
      d("поздний", { date: "2027-01-19", start: "09:00", room: "2" }),
      d("сегодня утром", { date: "2026-11-20", start: "09:00", room: "3" }),
      d("сегодня днём", { date: "2026-11-20", start: "15:00", room: "4" }),
      d("без даты", null),
    ];
    // 20.11 08:30 МСК (05:30 UTC): утренний ещё впереди.
    expect(nextExam(list, new Date("2026-11-20T05:30:00Z"))?.discipline.subject).toBe(
      "сегодня утром",
    );
    // 20.11 10:00 МСК: утренний уже начался — следующий днём, «сегодня».
    const noon = nextExam(list, new Date("2026-11-20T07:00:00Z"));
    expect(noon?.discipline.subject).toBe("сегодня днём");
    expect(noon && whenLabel(noon.daysLeft)).toBe("сегодня");
    // 19.11 22:30 UTC — в Москве уже 20.11 01:30: «сегодня», а не «завтра».
    expect(nextExam(list, new Date("2026-11-19T22:30:00Z"))?.daysLeft).toBe(0);
    // После всех — null.
    expect(nextExam(list, new Date("2027-02-01T00:00:00Z"))).toBeNull();
    expect(nextExam([d("без даты", null)], new Date("2026-11-20T00:00:00Z"))).toBeNull();
  });

  it("«завтра», «через N дней»", () => {
    expect(whenLabel(1)).toBe("завтра");
    expect(whenLabel(3)).toBe("через 3 дня");
    expect(whenLabel(54)).toBe("через 54 дня");
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

function open(grades?: Grades) {
  if (grades) server.use(http.get(routes.me.grades.path, () => HttpResponse.json(grades)));
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <GradesPage now={NOW} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("даты экзаменов: экран", () => {
  it("сверху «Ближайший экзамен», в карточках — дата, время, аудитория", async () => {
    open();
    const block = await screen.findByRole("region", { name: "Ближайший экзамен" });
    expect(within(block).getByRole("heading", { name: "Машинное обучение" })).toBeTruthy();
    expect(within(block).getByText("Экзамен 12 января, 10:00, ауд. А-214")).toBeTruthy();
    expect(within(block).getByText(/через 54 дня/)).toBeTruthy();
    const list = screen.getByRole("region", { name: "Дисциплины" });
    expect(within(list).getByText("Зачёт 17 ноября, 14:00, ауд. Б-305")).toBeTruthy();
  });

  it("дат нет — блока нет, в карточках «Дата пока не назначена»", async () => {
    const grades = {
      ...fixtures.grades,
      disciplines: fixtures.grades.disciplines.map((x) => ({ ...x, exam: null })),
    };
    open(grades);
    expect(await screen.findByRole("heading", { name: "Как у меня дела" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Ближайший экзамен" })).toBeNull();
    expect(screen.getAllByText("Дата пока не назначена")).toHaveLength(grades.disciplines.length);
  });
});
