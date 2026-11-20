import type { DisciplineGrade, Grades, GradesSummary, PastDebt } from "@aihs/contract";
import { and, asc, eq, inArray, ne, type SQL } from "drizzle-orm";
import type { Db } from "../../db/client";
import * as schema from "../../db/schema";
import { semesterOrder } from "../../lib/semester-order";

const POSITIVE = new Set<DisciplineGrade["result"]>([
  "excellent",
  "good",
  "satisfactory",
  "passed",
]);
const DEBT = new Set<DisciplineGrade["result"]>(["unsatisfactory", "failed"]);

/**
 * Сводка «как у меня дела»: средний итоговый балл по текущему семестру (округление до сотых,
 * 0 если дисциплин нет), всего, закрыто (итог есть и положительный), долги — `unsatisfactory`
 * или `failed` в текущем семестре плюс долги прошлых семестров. Чистая функция.
 */
export function summarize(
  disciplines: DisciplineGrade[],
  pastDebts: PastDebt[] = [],
): GradesSummary {
  const total = disciplines.reduce((sum, d) => sum + d.totalPoints, 0);
  const average = disciplines.length ? total / disciplines.length : 0;
  return {
    averagePoints: Math.round(average * 100) / 100,
    disciplinesTotal: disciplines.length,
    disciplinesPassed: disciplines.filter((d) => POSITIVE.has(d.result)).length,
    debts: disciplines.filter((d) => DEBT.has(d.result)).length + pastDebts.length,
  };
}

/**
 * Успеваемость студента из сессии за текущий семестр: дисциплины с баллами БРС и датами
 * экзаменов, сроки сессии, долги прошлых семестров и сводка (долги в ней — вместе с прошлыми).
 * Студента или текущего семестра нет → `null` (→ 404).
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

  const current = await gradeRows(
    db,
    and(eq(schema.grades.studentId, studentId), eq(schema.grades.semesterId, semester.id)),
  );
  const disciplines: DisciplineGrade[] = current.map(({ semester: _semester, ...d }) => d);
  const pastDebts: PastDebt[] = (
    await gradeRows(
      db,
      and(
        eq(schema.grades.studentId, studentId),
        ne(schema.grades.semesterId, semester.id),
        inArray(schema.grades.result, [...DEBT]),
      ),
    )
  ).sort((a, b) => semesterOrder(a.semester) - semesterOrder(b.semester));
  return {
    semester: semester.name,
    session:
      semester.sessionStart && semester.sessionEnd
        ? { startDate: semester.sessionStart, endDate: semester.sessionEnd }
        : null,
    disciplines,
    pastDebts,
    summary: summarize(disciplines, pastDebts),
  };
}

/** Строки успеваемости по условию: с названием семестра, по алфавиту дисциплин. */
async function gradeRows(db: Db, where: SQL | undefined): Promise<PastDebt[]> {
  const rows = await db
    .select({
      id: schema.grades.id,
      semester: schema.semesters.name,
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
    .innerJoin(schema.semesters, eq(schema.semesters.id, schema.grades.semesterId))
    .innerJoin(schema.subjects, eq(schema.subjects.id, schema.grades.subjectId))
    .innerJoin(schema.teachers, eq(schema.teachers.id, schema.grades.teacherId))
    .where(where)
    .orderBy(asc(schema.subjects.name), asc(schema.grades.id));
  return rows.map(({ examDate, examStart, examRoom, ...r }) => ({
    ...r,
    totalPoints: r.semesterPoints + (r.examPoints ?? 0),
    exam:
      examDate && examStart && examRoom
        ? { date: examDate, start: examStart, room: examRoom }
        : null,
  }));
}
