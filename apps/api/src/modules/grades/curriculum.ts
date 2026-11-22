import type { Curriculum, CurriculumSemester } from "@aihs/contract";
import { and, asc, eq } from "drizzle-orm";
import type { Db } from "../../db/client";
import { curriculum, grades, semesters, students, subjects, teachers } from "../../db/schema";
import { semesterOrder } from "../../lib/semester-order";
import { gradeProgress } from "./service";

export async function getCurriculum(db: Db, studentId: string): Promise<Curriculum | null> {
  const [student] = await db
    .select({ groupId: students.groupId })
    .from(students)
    .where(eq(students.id, studentId));
  if (!student) return null;

  const rows = await db
    .select({
      semester: { id: semesters.id, name: semesters.name },
      isCurrent: semesters.isCurrent,
      subjectId: curriculum.subjectId,
      subject: subjects.name,
      teacher: teachers.fullName,
      controlForm: curriculum.controlForm,
      credits: curriculum.credits,
      hours: {
        lectures: curriculum.lectureHours,
        practice: curriculum.practiceHours,
        independent: curriculum.independentHours,
      },
      grade: {
        semesterPoints: grades.semesterPoints,
        examPoints: grades.examPoints,
        result: grades.result,
        examDate: grades.examDate,
        examStart: grades.examStart,
        examRoom: grades.examRoom,
      },
    })
    .from(curriculum)
    .innerJoin(semesters, eq(semesters.id, curriculum.semesterId))
    .innerJoin(subjects, eq(subjects.id, curriculum.subjectId))
    .innerJoin(teachers, eq(teachers.id, curriculum.teacherId))
    .leftJoin(
      grades,
      and(
        eq(grades.studentId, studentId),
        eq(grades.semesterId, curriculum.semesterId),
        eq(grades.subjectId, curriculum.subjectId),
      ),
    )
    .where(eq(curriculum.groupId, student.groupId))
    .orderBy(asc(subjects.name), asc(subjects.id));

  const bySemester = new Map<string, CurriculumSemester>();
  let currentSemesterId: string | null = null;
  for (const { semester, isCurrent, grade, ...discipline } of rows) {
    if (isCurrent) currentSemesterId = semester.id;
    let entry = bySemester.get(semester.id);
    if (!entry) {
      entry = { ...semester, disciplines: [] };
      bySemester.set(semester.id, entry);
    }
    entry.disciplines.push({ ...discipline, grade: grade ? gradeProgress(grade) : null });
  }
  return {
    currentSemesterId,
    semesters: [...bySemester.values()].sort(
      (a, b) => semesterOrder(b.name) - semesterOrder(a.name),
    ),
  };
}
