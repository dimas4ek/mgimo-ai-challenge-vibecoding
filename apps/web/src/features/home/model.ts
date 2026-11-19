// Чистая логика главной «Сегодня» без React: что показать в каждом блоке и в каком порядке.
// Время — по Москве (через модель расписания), а не по часам устройства.
import type { Notification, RequestListItem } from "@aihs/contract";

/** Сколько карточек показываем в блоке главной; остальное — по ссылке «Все». */
export const HOME_LIMIT = 3;

/** «Доброе утро» / «Добрый день» / «Добрый вечер» / «Доброй ночи» по московскому часу `now`. */
export function greeting(_now: Date): string {
  throw new Error("not implemented");
}

/** Имя для приветствия из `displayName` «Мирослава Лебедянская» → «Мирослава». */
export function firstName(_displayName: string): string {
  throw new Error("not implemented");
}

/** Дедлайны (`type: "deadline"`): непрочитанные сверху, затем новые; не больше `HOME_LIMIT`. */
export function homeDeadlines(_items: readonly Notification[]): Notification[] {
  throw new Error("not implemented");
}

/** Объявления деканата (`type: "news"`): непрочитанные сверху, затем новые; не больше `HOME_LIMIT`. */
export function homeAnnouncements(_items: readonly Notification[]): Notification[] {
  throw new Error("not implemented");
}

/**
 * Заявки, у которых недавно сменился статус: не `submitted` и `updatedAt` не старше 7 дней от `now`.
 * Свежие сверху, не больше `HOME_LIMIT`.
 */
export function recentRequestUpdates(
  _items: readonly RequestListItem[],
  _now: Date,
): RequestListItem[] {
  throw new Error("not implemented");
}
