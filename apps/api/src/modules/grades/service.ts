import type { DisciplineGrade, Grades, GradesSummary } from "@aihs/contract";
import type { Db } from "../../db/client";

/**
 * Сводка «как у меня дела» по дисциплинам: средний итоговый балл (округление до сотых,
 * 0 если дисциплин нет), всего, закрыто (итог есть и положительный), долги
 * (`unsatisfactory` или `failed`). Чистая функция.
 */
export function summarize(_disciplines: DisciplineGrade[]): GradesSummary {
  throw new Error("not implemented");
}

/**
 * Успеваемость студента из сессии за текущий семестр: дисциплины с баллами БРС, сроки сессии
 * и сводка. Студента или текущего семестра нет → `null` (→ 404).
 */
export async function getGrades(_db: Db, _studentId: string): Promise<Grades | null> {
  throw new Error("not implemented");
}
