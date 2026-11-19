import { z } from "zod";
import { IdSchema, IsoDateSchema } from "./common";

/** Форма контроля: экзамен, зачёт, дифференцированный зачёт. */
export const ControlFormSchema = z.enum(["exam", "credit", "graded_credit"]);
export type ControlForm = z.infer<typeof ControlFormSchema>;

/**
 * Итог по дисциплине. `excellent`…`unsatisfactory` — для экзамена и диф. зачёта,
 * `passed`/`failed` — для зачёта, `pending` — итога ещё нет.
 */
export const GradeResultSchema = z.enum([
  "excellent",
  "good",
  "satisfactory",
  "unsatisfactory",
  "passed",
  "failed",
  "pending",
]);
export type GradeResult = z.infer<typeof GradeResultSchema>;

/** Максимум баллов БРС: семестр + экзамен = 100. */
export const BRS_MAX = { semester: 60, exam: 40, total: 100 } as const;

/** Строка успеваемости по одной дисциплине. */
export const DisciplineGradeSchema = z.object({
  id: IdSchema,
  subject: z.string().min(1),
  teacher: z.string().min(1),
  controlForm: ControlFormSchema,
  /** Трудоёмкость, з. е. */
  credits: z.number().int().min(1).max(30),
  /** Баллы за семестр, 0–60. */
  semesterPoints: z.number().min(0).max(BRS_MAX.semester),
  /** Баллы за экзамен/зачёт, 0–40; `null` — ещё не сдавал. */
  examPoints: z.number().min(0).max(BRS_MAX.exam).nullable(),
  /** Сумма, 0–100. */
  totalPoints: z.number().min(0).max(BRS_MAX.total),
  result: GradeResultSchema,
});
export type DisciplineGrade = z.infer<typeof DisciplineGradeSchema>;

/** Экзаменационная сессия текущего семестра. */
export const ExamSessionSchema = z.object({
  startDate: IsoDateSchema,
  endDate: IsoDateSchema,
});
export type ExamSession = z.infer<typeof ExamSessionSchema>;

/** Сводка «как у меня дела». */
export const GradesSummarySchema = z.object({
  /** Средний итоговый балл по дисциплинам, 0–100. */
  averagePoints: z.number().min(0).max(BRS_MAX.total),
  disciplinesTotal: z.number().int().min(0),
  /** Закрыто: итог есть и он положительный. */
  disciplinesPassed: z.number().int().min(0),
  /** Долги: `unsatisfactory` или `failed`. */
  debts: z.number().int().min(0),
});
export type GradesSummary = z.infer<typeof GradesSummarySchema>;

/** Ответ `GET /api/me/grades`. */
export const GradesSchema = z.object({
  /** «Осенний семестр 2026/27». */
  semester: z.string().min(1),
  session: ExamSessionSchema.nullable(),
  disciplines: z.array(DisciplineGradeSchema),
  summary: GradesSummarySchema,
});
export type Grades = z.infer<typeof GradesSchema>;
