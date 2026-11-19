// Чистая логика ленты уведомлений без React: подписи типов, группы по дням, время, бейдж.
// Даты — по Москве, а не по часам устройства.
import type { Notification, NotificationType } from "@aihs/contract";
import type { BadgeTone } from "../../ui";

/** Подпись и тон бейджа типа: «Новость», «Дедлайн», «Расписание», «Заявка». Иконку добавляет UI. */
export function notificationTypeView(_type: NotificationType): { label: string; tone: BadgeTone } {
  throw new Error("not implemented");
}

/**
 * Группы ленты по дням (по Москве), новые сверху: «Сегодня», «Вчера», «12 ноября»
 * (с годом, если он не совпадает с годом `now`). Внутри группы — новые сверху.
 */
export function groupByDay(
  _items: readonly Notification[],
  _now: Date,
): { title: string; items: Notification[] }[] {
  throw new Error("not implemented");
}

/** Время внутри группы: «только что», «5 мин назад», «2 ч назад» (до 6 часов), дальше «14:05». */
export function formatTime(_iso: string, _now: Date): string {
  throw new Error("not implemented");
}

/** Число на бейдже навигации: `0` → `null` (бейдж не показываем), больше 9 → «9+». */
export function badgeText(_count: number): string | null {
  throw new Error("not implemented");
}

/** «1 непрочитанное», «3 непрочитанных», «Всё прочитано» — подпись под заголовком и `aria-label`. */
export function unreadLabel(_count: number): string {
  throw new Error("not implemented");
}
