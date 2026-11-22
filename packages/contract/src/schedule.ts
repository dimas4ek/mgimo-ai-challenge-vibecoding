import { z } from "zod";
import { IdSchema, IsoDateSchema, TimeSchema } from "./common";

export const LessonTypeSchema = z.enum(["lecture", "seminar", "lab", "consultation", "exam"]);
export type LessonType = z.infer<typeof LessonTypeSchema>;

/** Вид изменения пары: перенесена, заменена (другой преподаватель/аудитория), отменена. */
export const LessonChangeKindSchema = z.enum(["moved", "replaced", "cancelled"]);
export type LessonChangeKind = z.infer<typeof LessonChangeKindSchema>;

/** Изменение пары относительно обычного расписания. Показывается заметно. */
export const LessonChangeSchema = z.object({
  kind: LessonChangeKindSchema,
  /** Пояснение для студента: «Перенесено с 18.11 из-за конференции». */
  note: z.string().min(1),
  /** Для `moved`: где пара стояла раньше. */
  originalDate: IsoDateSchema.nullable(),
  originalStart: TimeSchema.nullable(),
});
export type LessonChange = z.infer<typeof LessonChangeSchema>;

export const LessonSchema = z.object({
  id: IdSchema,
  date: IsoDateSchema,
  start: TimeSchema,
  end: TimeSchema,
  subject: z.string().min(1),
  /** Ссылка на предмет учебного плана. Старые ответы могут не содержать идентификатор. */
  subjectId: IdSchema.optional(),
  type: LessonTypeSchema,
  room: z.string().min(1),
  /** ФИО преподавателя, вымышленное. */
  teacher: z.string().min(1),
  /** `null` — пара идёт как обычно. */
  change: LessonChangeSchema.nullable(),
});
export type Lesson = z.infer<typeof LessonSchema>;

/**
 * Query `GET /api/me/schedule?week=YYYY-MM-DD`: любая дата недели; без параметра — текущая неделя по МСК.
 * Годы 2000–2099: дальше расписания нет, а у 9999-12-27 конец недели уходит в 10000 год.
 */
export const ScheduleQuerySchema = z.object({
  week: IsoDateSchema.refine((d) => d >= "2000-01-01" && d <= "2099-12-31", {
    message: "Неделя вне 2000–2099 годов",
  }).optional(),
});
export type ScheduleQuery = z.infer<typeof ScheduleQuerySchema>;

/** Неделя с понедельника по воскресенье. Пары отсортированы по дате и времени. */
export const WeekScheduleSchema = z.object({
  weekStart: IsoDateSchema,
  weekEnd: IsoDateSchema,
  lessons: z.array(LessonSchema),
});
export type WeekSchedule = z.infer<typeof WeekScheduleSchema>;
