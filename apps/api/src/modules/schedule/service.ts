import type { WeekSchedule } from "@aihs/contract";
import { and, asc, between, eq } from "drizzle-orm";
import type { Db } from "../../db/client";
import * as schema from "../../db/schema";
import { addDays, mondayOf, moscowDate } from "../../lib/moscow-time";

/**
 * Расписание группы студента на неделю (пн–вс), в которую попадает `week` (`YYYY-MM-DD`);
 * без `week` — текущая неделя по Москве относительно `now`. Пары по дате и времени,
 * с переносами, заменами и отменами (`change`). Студента нет → `null`.
 */
export async function getWeekSchedule(
  db: Db,
  studentId: string,
  week: string | undefined,
  now: Date,
): Promise<WeekSchedule | null> {
  const [student] = await db
    .select({ groupId: schema.students.groupId })
    .from(schema.students)
    .where(eq(schema.students.id, studentId));
  if (!student) return null;

  const weekStart = mondayOf(week ?? moscowDate(now));
  const weekEnd = addDays(weekStart, 6);
  const rows = await db
    .select({
      id: schema.lessons.id,
      date: schema.lessons.date,
      start: schema.lessons.start,
      end: schema.lessons.end,
      subject: schema.subjects.name,
      type: schema.lessons.type,
      room: schema.lessons.room,
      teacher: schema.teachers.fullName,
      changeKind: schema.lessonChanges.kind,
      changeNote: schema.lessonChanges.note,
      originalDate: schema.lessonChanges.originalDate,
      originalStart: schema.lessonChanges.originalStart,
    })
    .from(schema.lessons)
    .innerJoin(schema.subjects, eq(schema.subjects.id, schema.lessons.subjectId))
    .innerJoin(schema.teachers, eq(schema.teachers.id, schema.lessons.teacherId))
    .leftJoin(schema.lessonChanges, eq(schema.lessonChanges.lessonId, schema.lessons.id))
    .where(
      and(
        eq(schema.lessons.groupId, student.groupId),
        between(schema.lessons.date, weekStart, weekEnd),
      ),
    )
    .orderBy(asc(schema.lessons.date), asc(schema.lessons.start), asc(schema.lessons.id));

  return {
    weekStart,
    weekEnd,
    lessons: rows.map((r) => ({
      id: r.id,
      date: r.date,
      start: r.start,
      end: r.end,
      subject: r.subject,
      type: r.type,
      room: r.room,
      teacher: r.teacher,
      change:
        r.changeKind && r.changeNote
          ? {
              kind: r.changeKind,
              note: r.changeNote,
              originalDate: r.originalDate,
              originalStart: r.originalStart,
            }
          : null,
    })),
  };
}
