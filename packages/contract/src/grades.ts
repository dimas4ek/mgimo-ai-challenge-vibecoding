import { z } from "zod";
import { IdSchema, IsoDateSchema, TimeSchema } from "./common";

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

/** Когда и где экзамен или зачёт по дисциплине (время по Москве). */
export const ExamSlotSchema = z.object({
  date: IsoDateSchema,
  /** Начало, `HH:MM`. */
  start: TimeSchema,
  /** Аудитория, например «А-214». */
  room: z.string().min(1),
});
export type ExamSlot = z.infer<typeof ExamSlotSchema>;

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
  /** Экзамен или зачёт; `null` — дата ещё не назначена. */
  exam: ExamSlotSchema.nullable(),
});
export type DisciplineGrade = z.infer<typeof DisciplineGradeSchema>;

/** Несданная дисциплина прошлого семестра: строка успеваемости и семестр, в котором остался долг. */
export const PastDebtSchema = DisciplineGradeSchema.extend({
  /** «Весенний семестр 2025/26». */
  semester: z.string().min(1),
});
export type PastDebt = z.infer<typeof PastDebtSchema>;

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
  /**
   * Долги: `unsatisfactory` или `failed` в текущем семестре **и** несданные дисциплины прошлых
   * семестров (`pastDebts`). Средний балл и «закрыто» считаются только по текущему семестру.
   */
  debts: z.number().int().min(0),
});
export type GradesSummary = z.infer<typeof GradesSummarySchema>;

/** Ответ `GET /api/me/grades`. */
export const GradesSchema = z.object({
  /** «Осенний семестр 2026/27». */
  semester: z.string().min(1),
  session: ExamSessionSchema.nullable(),
  disciplines: z.array(DisciplineGradeSchema),
  /** Несданные дисциплины прошлых семестров, от старых к новым; пусто, если долгов нет. */
  pastDebts: z.array(PastDebtSchema),
  summary: GradesSummarySchema,
});
export type Grades = z.infer<typeof GradesSchema>;
