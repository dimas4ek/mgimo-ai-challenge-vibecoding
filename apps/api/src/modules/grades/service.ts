import type { DisciplineGrade, Grades, GradesSummary } from "@aihs/contract";
import { and, asc, eq } from "drizzle-orm";
import type { Db } from "../../db/client";
import * as schema from "../../db/schema";

const POSITIVE = new Set<DisciplineGrade["result"]>([
  "excellent",
  "good",
  "satisfactory",
  "passed",
]);
const DEBT = new Set<DisciplineGrade["result"]>(["unsatisfactory", "failed"]);

/**
 * Сводка «как у меня дела» по дисциплинам: средний итоговый балл (округление до сотых,
 * 0 если дисциплин нет), всего, закрыто (итог есть и положительный), долги
 * (`unsatisfactory` или `failed`). Чистая функция.
 */
export function summarize(disciplines: DisciplineGrade[]): GradesSummary {
  const total = disciplines.reduce((sum, d) => sum + d.totalPoints, 0);
  const average = disciplines.length ? total / disciplines.length : 0;
  return {
    averagePoints: Math.round(average * 100) / 100,
    disciplinesTotal: disciplines.length,
    disciplinesPassed: disciplines.filter((d) => POSITIVE.has(d.result)).length,
    debts: disciplines.filter((d) => DEBT.has(d.result)).length,
  };
}

/**
 * Успеваемость студента из сессии за текущий семестр: дисциплины с баллами БРС и датами экзаменов, сроки сессии
 * и сводка. Студента или текущего семестра нет → `null` (→ 404).
 */
export async function getGrades(db: Db, studentId: string): Promise<Grades | null> {
  const [student] = await db
    .select({ id: schema.students.id })
    .from(schema.students)
    .where(eq(schema.students.id, studentId));
  if (!student) return null;
  const [semester] = await db
    .select()
    .from(schema.semesters)
    .where(eq(schema.semesters.isCurrent, true));
  if (!semester) return null;

  const rows = await db
    .select({
      id: schema.grades.id,
      subject: schema.subjects.name,
      teacher: schema.teachers.fullName,
      controlForm: schema.grades.controlForm,
      credits: schema.grades.credits,
      semesterPoints: schema.grades.semesterPoints,
      examPoints: schema.grades.examPoints,
      result: schema.grades.result,
      examDate: schema.grades.examDate,
      examStart: schema.grades.examStart,
      examRoom: schema.grades.examRoom,
    })
    .from(schema.grades)
    .innerJoin(schema.subjects, eq(schema.subjects.id, schema.grades.subjectId))
    .innerJoin(schema.teachers, eq(schema.teachers.id, schema.grades.teacherId))
    .where(and(eq(schema.grades.studentId, studentId), eq(schema.grades.semesterId, semester.id)))
    .orderBy(asc(schema.subjects.name), asc(schema.grades.id));

  const disciplines: DisciplineGrade[] = rows.map(({ examDate, examStart, examRoom, ...r }) => ({
    ...r,
    totalPoints: r.semesterPoints + (r.examPoints ?? 0),
    exam:
      examDate && examStart && examRoom
        ? { date: examDate, start: examStart, room: examRoom }
        : null,
  }));
  return {
    semester: semester.name,
    session:
      semester.sessionStart && semester.sessionEnd
        ? { startDate: semester.sessionStart, endDate: semester.sessionEnd }
        : null,
    disciplines,
    summary: summarize(disciplines),
  };
}
