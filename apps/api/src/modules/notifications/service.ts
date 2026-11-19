import type { Notification, NotificationList, NotificationType } from "@aihs/contract";
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../../db/client";
import * as schema from "../../db/schema";

/** Что отправить. `link` — путь внутри приложения (`/requests/<id>`) или `null`. */
export interface NotifyPayload {
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
}

type Row = typeof schema.notifications.$inferSelect;

const toDto = (n: Row): Notification => ({
  id: n.id,
  type: n.type,
  title: n.title,
  body: n.body,
  createdAt: n.createdAt.toISOString(),
  read: n.read,
  link: n.link,
});

/**
 * Отправить уведомление студенту (используют другие модули: смена статуса заявки в #10).
 * `studentId` — id из таблицы students; уведомление пишется его пользователю. Студента нет → `null`.
 */
export async function notify(
  db: Db,
  studentId: string,
  payload: NotifyPayload,
  now: Date,
): Promise<Notification | null> {
  const [student] = await db
    .select({ userId: schema.students.userId })
    .from(schema.students)
    .where(eq(schema.students.id, studentId));
  if (!student) return null;
  const [row] = await db
    .insert(schema.notifications)
    .values({
      userId: student.userId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      link: payload.link ?? null,
      read: false,
      createdAt: now,
    })
    .returning();
  return row ? toDto(row) : null;
}

/** Лента пользователя, новые сверху, и число непрочитанных. */
export async function listNotifications(db: Db, userId: string): Promise<NotificationList> {
  const rows = await db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, userId))
    .orderBy(desc(schema.notifications.createdAt), desc(schema.notifications.id));
  const items = rows.map(toDto);
  return { items, unreadCount: items.filter((n) => !n.read).length };
}

/**
 * Отметить прочитанным. Выборка `id = ? AND user_id = ?`: чужое или несуществующее — `null` (→ 404).
 * Повторная отметка безопасна.
 */
export async function markRead(db: Db, userId: string, id: string): Promise<Notification | null> {
  const [row] = await db
    .update(schema.notifications)
    .set({ read: true })
    .where(and(eq(schema.notifications.id, id), eq(schema.notifications.userId, userId)))
    .returning();
  return row ? toDto(row) : null;
}
