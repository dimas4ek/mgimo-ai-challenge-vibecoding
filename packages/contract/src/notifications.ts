import { z } from "zod";
import { IdSchema, IsoDateTimeSchema } from "./common";

/** Новость, дедлайн, изменение в расписании, изменение статуса заявки. */
export const NotificationTypeSchema = z.enum(["news", "deadline", "schedule_change", "request"]);
export type NotificationType = z.infer<typeof NotificationTypeSchema>;

export const NotificationSchema = z.object({
  id: IdSchema,
  type: NotificationTypeSchema,
  title: z.string().min(1),
  body: z.string(),
  createdAt: IsoDateTimeSchema,
  read: z.boolean(),
  /** Путь внутри приложения, куда ведёт уведомление (`/requests/<id>`), или `null`. */
  link: z.string().startsWith("/").nullable(),
});
export type Notification = z.infer<typeof NotificationSchema>;

/** Ответ `GET /api/me/notifications`, новые сверху. */
export const NotificationListSchema = z.object({
  items: z.array(NotificationSchema),
  unreadCount: z.number().int().min(0),
});
export type NotificationList = z.infer<typeof NotificationListSchema>;
