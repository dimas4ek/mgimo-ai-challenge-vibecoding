// Чистая логика главной «Сегодня» без React: что показать в каждом блоке и в каком порядке.
// Время — по Москве (через модель расписания), а не по часам устройства.
import type { Lesson, Notification, NotificationType, RequestListItem } from "@aihs/contract";
import { addDays, moscowTime, moscowToday } from "../schedule/model";

/** Сколько карточек показываем в блоке главной; остальное — по ссылке «Все». */
export const HOME_LIMIT = 3;

const WEEK = 7 * 86_400_000;

/** «Доброе утро» / «Добрый день» / «Добрый вечер» / «Доброй ночи» по московскому часу `now`. */
export function greeting(now: Date): string {
  const hour = Number(moscowTime(now).slice(0, 2));
  if (hour >= 5 && hour < 12) return "Доброе утро";
  if (hour >= 12 && hour < 17) return "Добрый день";
  if (hour >= 17 && hour < 23) return "Добрый вечер";
  return "Доброй ночи";
}

/** Имя для приветствия из `displayName` «Мирослава Лебедянская» → «Мирослава». */
export function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] ?? displayName;
}

/** Непрочитанные сверху, затем новые; не больше `HOME_LIMIT`. */
function pick(items: readonly Notification[], type: NotificationType): Notification[] {
  return items
    .filter((n) => n.type === type)
    .sort((a, b) => Number(a.read) - Number(b.read) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, HOME_LIMIT);
}

/** Дедлайны (`type: "deadline"`): непрочитанные сверху, затем новые; не больше `HOME_LIMIT`. */
export function homeDeadlines(items: readonly Notification[]): Notification[] {
  return pick(items, "deadline");
}

/** Объявления деканата (`type: "news"`): непрочитанные сверху, затем новые; не больше `HOME_LIMIT`. */
export function homeAnnouncements(items: readonly Notification[]): Notification[] {
  return pick(items, "news");
}

/**
 * Заявки, у которых недавно сменился статус: не `submitted` и `updatedAt` не старше 7 дней от `now`.
 * Свежие сверху, не больше `HOME_LIMIT`.
 */
export function recentRequestUpdates(
  items: readonly RequestListItem[],
  now: Date,
): RequestListItem[] {
  const since = now.getTime() - WEEK;
  return items
    .filter((r) => r.status !== "submitted" && Date.parse(r.updatedAt) >= since)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, HOME_LIMIT);
}

/**
 * Изменения в расписании на ближайшие `days` дней по Москве, начиная с сегодня (#39):
 * пары с `change` (перенос, замена, отмена), которые ещё не закончились. По дате и времени.
 * Пару, перенесённую на другой день, показываем в день, когда она теперь идёт.
 */
export function upcomingChanges(lessons: readonly Lesson[], now: Date, days = 3): Lesson[] {
  const today = moscowToday(now);
  const time = moscowTime(now);
  const last = addDays(today, days - 1);
  return lessons
    .filter(
      (l) =>
        l.change !== null &&
        l.date >= today &&
        l.date <= last &&
        !(l.date === today && l.end <= time),
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
}

/** Последний день окна `upcomingChanges`: по нему видно, нужна ли следующая неделя. */
export function changesWindowEnd(now: Date, days = 3): string {
  return addDays(moscowToday(now), days - 1);
}
