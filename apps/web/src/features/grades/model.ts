// Чистая логика экрана успеваемости без React: подписи, статус дисциплины, сроки сессии.
// Её же использует калькулятор «что нужно для стипендии / закрыть сессию» (#24).
// Даты — по Москве, а не по часам устройства.
import type { ControlForm, DisciplineGrade, ExamSession, GradeResult } from "@aihs/contract";
import type { BadgeTone } from "../../ui";

/** Состояние дисциплины для студента: закрыта, долг или итога ещё нет. */
export type DisciplineState = "passed" | "debt" | "pending";

/** «Экзамен», «Зачёт», «Дифф. зачёт». */
export function controlFormLabel(_form: ControlForm): string {
  throw new Error("not implemented");
}

/** Подпись и тон бейджа итога: «Отлично» (success), «Незачёт» (danger), «Нет итога» (neutral)… */
export function resultLabel(_result: GradeResult): { label: string; tone: BadgeTone } {
  throw new Error("not implemented");
}

/** Закрыта (положительный итог), долг (`unsatisfactory`/`failed`) или итога нет (`pending`). */
export function disciplineState(_d: DisciplineGrade): DisciplineState {
  throw new Error("not implemented");
}

/** Порядок на экране: сначала долги, потом без итога, потом закрытые; внутри — по названию. */
export function sortForDisplay(_disciplines: readonly DisciplineGrade[]): DisciplineGrade[] {
  throw new Error("not implemented");
}

/** «28 декабря – 24 января». */
export function formatSessionRange(_session: ExamSession): string {
  throw new Error("not implemented");
}

/**
 * Где сессия относительно `now` (по Москве): `before` с числом дней до начала,
 * `ongoing` (идёт, включая первый и последний день) или `after`.
 */
export function sessionPhase(
  _session: ExamSession,
  _now: Date,
): { phase: "before"; daysLeft: number } | { phase: "ongoing" } | { phase: "after" } {
  throw new Error("not implemented");
}

/** «1 день», «3 дня», «12 дней» — склонение по числу. */
export function pluralDays(_n: number): string {
  throw new Error("not implemented");
}
