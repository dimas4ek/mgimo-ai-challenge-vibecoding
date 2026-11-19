import { z } from "zod";
import { IdSchema, IsoDateTimeSchema } from "./common";

/** Справки (выдаёт деканат) и заявления (решение деканата). */
export const RequestTypeSchema = z.enum([
  // справки
  "enrollment_certificate",
  "scholarship_certificate",
  "military_registration_certificate",
  "transcript",
  // заявления
  "retake_application",
  "academic_leave_application",
  "individual_schedule_application",
]);
export type RequestType = z.infer<typeof RequestTypeSchema>;

export const RequestCategorySchema = z.enum(["certificate", "application"]);
export type RequestCategory = z.infer<typeof RequestCategorySchema>;

/** К какой группе относится тип заявки: так фронт делит форму, а API — очередь. */
export const REQUEST_CATEGORY = {
  enrollment_certificate: "certificate",
  scholarship_certificate: "certificate",
  military_registration_certificate: "certificate",
  transcript: "certificate",
  retake_application: "application",
  academic_leave_application: "application",
  individual_schedule_application: "application",
} as const satisfies Record<RequestType, RequestCategory>;

/** Жизненный цикл: подана → на рассмотрении → готова / отклонена. */
export const RequestStatusSchema = z.enum(["submitted", "in_review", "ready", "rejected"]);
export type RequestStatus = z.infer<typeof RequestStatusSchema>;

/** Вход `POST /api/me/requests`. */
export const CreateRequestInputSchema = z.object({
  type: RequestTypeSchema,
  /** Пояснение студента: куда нужна справка, по какой дисциплине пересдача. */
  comment: z.string().trim().max(1000).optional(),
});
export type CreateRequestInput = z.infer<typeof CreateRequestInputSchema>;

/** Запись истории статусов. */
export const RequestStatusChangeSchema = z.object({
  status: RequestStatusSchema,
  at: IsoDateTimeSchema,
  /** Комментарий деканата (обязателен по смыслу при `rejected`). */
  comment: z.string().nullable(),
});
export type RequestStatusChange = z.infer<typeof RequestStatusChangeSchema>;

/** Элемент списка `GET /api/me/requests`, новые сверху. */
export const RequestListItemSchema = z.object({
  id: IdSchema,
  type: RequestTypeSchema,
  status: RequestStatusSchema,
  comment: z.string().nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type RequestListItem = z.infer<typeof RequestListItemSchema>;

/** Карточка заявки `GET /api/me/requests/:id`: история по времени, первая запись — `submitted`. */
export const RequestSchema = RequestListItemSchema.extend({
  history: z.array(RequestStatusChangeSchema).min(1),
});
export type Request = z.infer<typeof RequestSchema>;
