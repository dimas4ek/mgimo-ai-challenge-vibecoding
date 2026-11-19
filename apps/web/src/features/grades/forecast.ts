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

/** Прогноз по трём целям: `close`, `scholarship`, `increased` — в этом порядке. Чистая функция. */
export function forecast(_disciplines: readonly DisciplineGrade[]): GoalForecast[] {
  throw new Error("not implemented");
}
