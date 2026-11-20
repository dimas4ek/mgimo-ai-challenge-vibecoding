import { type DisciplineGrade, fixtures } from "@aihs/contract";
import { describe, expect, it } from "vitest";
import { forecast, type GoalForecast } from "./forecast";

let n = 0;
const d = (over: Partial<DisciplineGrade>): DisciplineGrade => ({
  id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
  subject: `Предмет ${n}`,
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

const byGoal = (list: GoalForecast[]) => Object.fromEntries(list.map((g) => [g.goal, g]));
const needs = (g: GoalForecast | undefined) => g?.items.map((i) => i.need);

describe("forecast", () => {
  it("три цели в порядке close → scholarship → increased", () => {
    expect(forecast([]).map((g) => g.goal)).toEqual(["close", "scholarship", "increased"]);
  });

  it("без дисциплин всё достижимо и ничего не осталось", () => {
    for (const g of forecast([])) {
      expect(g).toMatchObject({ reachable: true, remaining: 0, items: [] });
    }
  });

  it("фикстура контракта: экзамен впереди, «хорошо», «зачтено» и долг", () => {
    const g = byGoal(forecast(fixtures.grades.disciplines));
    // Машинное обучение 52/60, экзамен; ОЕЯ — «хорошо» 71; Этика — зачтено; ТВиС — неуд 22/60.
    expect(needs(g.close)).toEqual([
      { kind: "need", examPoints: 3 },
      { kind: "done" },
      { kind: "done" },
      { kind: "retake", examPoints: 33 },
    ]);
    expect(g.close).toMatchObject({ reachable: true, remaining: 2 });
    expect(needs(g.scholarship)?.[0]).toEqual({ kind: "need", examPoints: 18 });
    expect(needs(g.scholarship)?.[3]).toEqual({ kind: "impossible" });
    expect(g.scholarship?.reachable).toBe(false);
    expect(needs(g.increased)?.[0]).toEqual({ kind: "need", examPoints: 34 });
    expect(needs(g.increased)?.[1]).toEqual({ kind: "impossible" });
  });

  it("ровно на границе: хватает семестра → done; нужно ровно 40 → need 40; 41 → impossible", () => {
    const g = byGoal(
      forecast([d({ semesterPoints: 55 }), d({ semesterPoints: 46 }), d({ semesterPoints: 45 })]),
    );
    expect(needs(g.close)).toEqual([
      { kind: "done" },
      { kind: "need", examPoints: 9 },
      { kind: "need", examPoints: 10 },
    ]);
    expect(needs(g.increased)).toEqual([
      { kind: "need", examPoints: 31 },
      { kind: "need", examPoints: 40 },
      { kind: "impossible" },
    ]);
    expect(g.increased).toMatchObject({ reachable: false, remaining: 2 });
  });

  it("зачёт: для любой цели достаточно 55", () => {
    const g = byGoal(forecast([d({ controlForm: "credit", semesterPoints: 30 })]));
    for (const goal of ["close", "scholarship", "increased"]) {
      expect(needs(g[goal])).toEqual([{ kind: "need", examPoints: 25 }]);
    }
  });

  it("выставленный итог: проходит → done, ниже порога → impossible", () => {
    const g = byGoal(
      forecast([
        d({ result: "satisfactory", semesterPoints: 40, examPoints: 20, totalPoints: 60 }),
        d({ result: "excellent", semesterPoints: 58, examPoints: 38, totalPoints: 96 }),
      ]),
    );
    expect(needs(g.close)).toEqual([{ kind: "done" }, { kind: "done" }]);
    expect(needs(g.scholarship)).toEqual([{ kind: "impossible" }, { kind: "done" }]);
  });

  it("долг: пересдача закрывает сессию, но не даёт стипендии; не вытянуть и 40 → impossible", () => {
    const g = byGoal(
      forecast([
        d({
          result: "failed",
          controlForm: "credit",
          semesterPoints: 20,
          examPoints: 10,
          totalPoints: 30,
        }),
        d({ result: "unsatisfactory", semesterPoints: 10, examPoints: 20, totalPoints: 30 }),
      ]),
    );
    expect(needs(g.close)).toEqual([{ kind: "retake", examPoints: 35 }, { kind: "impossible" }]);
    expect(g.close?.reachable).toBe(false);
    expect(needs(g.scholarship)).toEqual([{ kind: "impossible" }, { kind: "impossible" }]);
  });
});
