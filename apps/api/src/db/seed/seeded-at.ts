import type { Db } from "../client";

/**
 * Момент последнего засева демо-данных (`seed(db, { now })` сохраняет `seededAt = now`).
 * От него сброс демо-данных строит заявки и уведомления, чтобы они совпадали с расписанием в базе.
 * Старая база без отметки — `null`.
 */
export async function getSeededAt(_db: Db): Promise<Date | null> {
  throw new Error("not implemented");
}
