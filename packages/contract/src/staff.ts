import { z } from "zod";
import { RequestSchema, RequestStatusSchema } from "./requests";

/** Query `GET /api/staff/requests?status=`: без параметра — все заявки. */
export const StaffRequestsQuerySchema = z.object({
  status: RequestStatusSchema.optional(),
});
export type StaffRequestsQuery = z.infer<typeof StaffRequestsQuerySchema>;

/** Заявка в очереди сотрудника: карточка заявки + кто подал. */
export const StaffRequestItemSchema = RequestSchema.extend({
  student: z.object({
    fullName: z.string().min(1),
    group: z.string().min(1),
  }),
});
export type StaffRequestItem = z.infer<typeof StaffRequestItemSchema>;

/**
 * Вход `POST /api/staff/requests/:id/status`. Вернуть в `submitted` нельзя. При отказе
 * причина обязательна: студент должен понять, что исправить.
 */
export const ChangeStatusInputSchema = z
  .object({
    status: RequestStatusSchema.exclude(["submitted"]),
    comment: z.string().trim().max(1000).optional(),
  })
  .refine((input) => input.status !== "rejected" || Boolean(input.comment), {
    path: ["comment"],
    message: "Напишите причину отказа",
  });
export type ChangeStatusInput = z.infer<typeof ChangeStatusInputSchema>;
