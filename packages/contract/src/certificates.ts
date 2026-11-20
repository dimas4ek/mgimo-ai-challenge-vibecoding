import { z } from "zod";
import { IdSchema, IsoDateSchema, IsoDateTimeSchema } from "./common";
import { BRS_MAX, ControlFormSchema, GradeResultSchema } from "./grades";
import { RequestTypeSchema } from "./requests";

/**
 * Токен проверки справки: 32 случайных байта в base64url (43 символа). Печатается в QR,
 * поэтому подобрать чужой токен перебором нельзя.
 */
export const CertificateTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/, "неверный токен");
export type CertificateToken = z.infer<typeof CertificateTokenSchema>;

/**
 * Строка оценок в выписке: снимок на момент выдачи справки. Если оценка потом изменится,
 * в уже выданной справке остаётся старое значение.
 */
export const CertificateGradeSchema = z.object({
  /** «Осенний семестр 2026/27». */
  semester: z.string().min(1),
  subject: z.string().min(1),
  controlForm: ControlFormSchema,
  /** Трудоёмкость, з. е. */
  credits: z.number().int().min(1).max(30),
  /** Итоговый балл, 0–100. */
  totalPoints: z.number().min(0).max(BRS_MAX.total),
  result: GradeResultSchema,
});
export type CertificateGrade = z.infer<typeof CertificateGradeSchema>;

/**
 * Справка для печати, `GET /api/me/certificates/:requestId`. Есть только у заявки-справки
 * (`REQUEST_CATEGORY[type] === "certificate"`) в статусе `ready`; иначе 404.
 * Токен выдаётся при первом запросе и дальше не меняется.
 */
export const CertificateSchema = z.object({
  requestId: IdSchema,
  type: RequestTypeSchema,
  /** Регистрационный номер для печати, вымышленный формат: `AIHS-2026-4F7A1C`. */
  number: z.string().min(1),
  /** Когда справка выдана (заявка стала `ready`). */
  issuedAt: IsoDateTimeSchema,
  token: CertificateTokenSchema,
  /** Путь страницы проверки на фронте: `/verify/<token>`. Полный адрес для QR собирает фронт. */
  verifyPath: z.string().startsWith("/verify/"),
  student: z.object({
    /** «Лебедянская Мирослава Игоревна». */
    fullName: z.string().min(1),
    recordBookNumber: z.string().min(1),
    faculty: z.string().min(1),
    program: z.string().min(1),
    course: z.number().int().min(1).max(6),
    group: z.string().min(1),
  }),
  /** Куда нужна справка — комментарий студента из заявки. */
  purpose: z.string().nullable(),
  /**
   * Оценки на дату выдачи, все семестры студента по порядку. Массив только у выписки
   * (`transcript`), у остальных типов `null`. В публичную проверку не попадает.
   */
  grades: z.array(CertificateGradeSchema).nullable(),
});
export type Certificate = z.infer<typeof CertificateSchema>;

/**
 * Публичная проверка подлинности, `GET /api/public/certificates/:token`, без входа.
 * Только минимум (`.claude/rules/security.md`): тип, дата, «действительна» и инициалы.
 * Без полного ФИО, группы и оценок. Неизвестный токен → 404.
 */
export const CertificateVerificationSchema = z.object({
  type: RequestTypeSchema,
  number: z.string().min(1),
  /** Дата выдачи по Москве. */
  issuedOn: IsoDateSchema,
  /** Справка действительна. Отзыва справок пока нет, поэтому сейчас всегда `true`. */
  valid: z.boolean(),
  /** Только инициалы: «Л. М. И.» (фамилия, имя, отчество). */
  holderInitials: z.string().min(1),
});
export type CertificateVerification = z.infer<typeof CertificateVerificationSchema>;
