// Калькулятор «что нужно набрать»: по текущим баллам БРС — сколько получить на оставшихся
// экзаменах и зачётах, чтобы закрыть сессию, получать стипендию или повышенную стипендию.
// Правила — вымышленное «Положение о стипендиях AI High School», они же показываются в UI.
import type { DisciplineGrade } from "@aihs/contract";

/** Цель студента на сессию. */
export type ForecastGoal = "close" | "scholarship" | "increased";

/**
 * Пороги итогового балла (семестр + экзамен, из 100) по вымышленному положению AI High School.
 * Зачёт: «зачтено» от `pass`. Экзамен и дифф. зачёт: «удовл.» от `pass`, «хорошо» от `good`,
 * «отлично» от `excellent`.
 */
export const FORECAST_RULES = {
  pass: 55,
  good: 70,
  excellent: 86,
} as const;

/** Описание цели для UI: название и правило простыми словами. */
export const GOALS: Record<ForecastGoal, { title: string; rule: string }> = {
  close: {
    title: "Закрыть сессию",
    rule: "Все дисциплины сданы: итог не ниже 55 баллов.",
  },
  scholarship: {
    title: "Стипендия",
    rule: "Без долгов и пересдач, экзамены и дифф. зачёты — не ниже 70 баллов («хорошо»).",
  },
  increased: {
    title: "Повышенная стипендия",
    rule: "Без долгов и пересдач, экзамены и дифф. зачёты — не ниже 86 баллов («отлично»).",
  },
};

/** Что нужно по одной дисциплине для цели. */
export type DisciplineNeed =
  /** Уже выполнено: итог есть и проходит, или хватает баллов за семестр. */
  | { kind: "done" }
  /** Нужно набрать на экзамене/зачёте не меньше `examPoints` из 40. */
  | { kind: "need"; examPoints: number }
  /** Долг: нужна пересдача, на ней — не меньше `examPoints` из 40 (только для `close`). */
  | { kind: "retake"; examPoints: number }
  /** Цель по этой дисциплине уже недостижима: итог выставлен ниже порога, долг или не хватит и 40. */
  | { kind: "impossible" };

export interface GoalForecast {
  goal: ForecastGoal;
  /** Цель достижима: ни одна дисциплина не `impossible`. */
  reachable: boolean;
  /** Сколько дисциплин ещё требуют баллов (`need` или `retake`). */
  remaining: number;
  /** По дисциплинам в порядке входа. */
  items: { id: string; subject: string; need: DisciplineNeed }[];
}

const ORDER: ForecastGoal[] = ["close", "scholarship", "increased"];
const EXAM_MAX = 40;

/** Порог итога для цели: зачёт всегда «зачтено», экзамен и дифф. зачёт — по цели. */
function threshold(goal: ForecastGoal, d: DisciplineGrade): number {
  if (d.controlForm === "credit" || goal === "close") return FORECAST_RULES.pass;
  return goal === "scholarship" ? FORECAST_RULES.good : FORECAST_RULES.excellent;
}

function needFor(goal: ForecastGoal, d: DisciplineGrade): DisciplineNeed {
  const min = threshold(goal, d);
  const examPoints = Math.max(0, min - d.semesterPoints);
  if (d.result === "unsatisfactory" || d.result === "failed") {
    // Со стипендией пересдача несовместима; закрыть сессию пересдачей можно.
    if (goal !== "close" || examPoints > EXAM_MAX) return { kind: "impossible" };
    return { kind: "retake", examPoints };
  }
  if (d.result !== "pending") {
    return d.totalPoints >= min ? { kind: "done" } : { kind: "impossible" };
  }
  if (examPoints === 0) return { kind: "done" };
  return examPoints > EXAM_MAX ? { kind: "impossible" } : { kind: "need", examPoints };
}

/** Прогноз по трём целям: `close`, `scholarship`, `increased` — в этом порядке. Чистая функция. */
export function forecast(disciplines: readonly DisciplineGrade[]): GoalForecast[] {
  return ORDER.map((goal) => {
    const items = disciplines.map((d) => ({
      id: d.id,
      subject: d.subject,
      need: needFor(goal, d),
    }));
    return {
      goal,
      reachable: items.every((i) => i.need.kind !== "impossible"),
      remaining: items.filter((i) => i.need.kind === "need" || i.need.kind === "retake").length,
      items,
    };
  });
}
