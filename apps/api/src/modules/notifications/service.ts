import type { Notification, NotificationList, NotificationType } from "@aihs/contract";
import type { Db } from "../../db/client";

/** Что отправить. `link` — путь внутри приложения (`/requests/<id>`) или `null`. */
export interface NotifyPayload {
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
}

/**
 * Отправить уведомление студенту (используют другие модули: смена статуса заявки в #10).
 * `studentId` — id из таблицы students; уведомление пишется его пользователю. Студента нет → `null`.
 */
export async function notify(
  _db: Db,
  _studentId: string,
  _payload: NotifyPayload,
  _now: Date,
): Promise<Notification | null> {
  throw new Error("not implemented");
}

/** Лента пользователя, новые сверху, и число непрочитанных. */
export async function listNotifications(_db: Db, _userId: string): Promise<NotificationList> {
  throw new Error("not implemented");
}

/**
 * Отметить прочитанным. Выборка `id = ? AND user_id = ?`: чужое или несуществующее — `null` (→ 404).
 * Повторная отметка безопасна.
 */
export async function markRead(
  _db: Db,
  _userId: string,
  _id: string,
): Promise<Notification | null> {
  throw new Error("not implemented");
}
