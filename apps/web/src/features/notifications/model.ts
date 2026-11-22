// Чистая логика ленты уведомлений без React: подписи типов, группы по дням, время, бейдж.
// Даты — по Москве, а не по часам устройства.
import type { Notification, NotificationType } from "@aihs/contract";
import type { BadgeTone } from "../../ui";

const typeView: Record<NotificationType, { label: string; tone: BadgeTone }> = {
  news: { label: "Новость", tone: "primary" },
  deadline: { label: "Дедлайн", tone: "warning" },
  schedule_change: { label: "Расписание", tone: "info" },
  request: { label: "Заявка", tone: "success" },
};

/** Подпись и тон бейджа типа: «Новость», «Дедлайн», «Расписание», «Заявка». Иконку добавляет UI. */
export function notificationTypeView(type: NotificationType): { label: string; tone: BadgeTone } {
  return typeView[type];
}

const TZ = "Europe/Moscow";
const isoDay = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: TZ,
});
const dayMonth = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: TZ });

/** Календарный срок без времени публикуется как дата по Москве. */
export const formatDueDate = (day: string) => dayMonth.format(new Date(`${day}T00:00:00Z`));
const dayMonthYear = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: TZ,
});
const clock = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: TZ,
});

/** Календарный день по Москве, `YYYY-MM-DD`. */
const moscowDay = (d: Date) => isoDay.format(d);

/** День до `day` (`YYYY-MM-DD`), арифметика в UTC-полночах. */
const previousDay = (day: string) => {
  const d = new Date(`${day}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

const byNewest = (a: Notification, b: Notification) =>
  Date.parse(b.createdAt) - Date.parse(a.createdAt);

/**
 * Группы ленты по дням (по Москве), новые сверху: «Сегодня», «Вчера», «12 ноября»
 * (с годом, если он не совпадает с годом `now`). Внутри группы — новые сверху.
 */
export function groupByDay(
  items: readonly Notification[],
  now: Date,
): { title: string; items: Notification[] }[] {
  const today = moscowDay(now);
  const yesterday = previousDay(today);
  const groups = new Map<string, Notification[]>();
  for (const item of [...items].sort(byNewest)) {
    const day = moscowDay(new Date(item.createdAt));
    const group = groups.get(day);
    if (group) group.push(item);
    else groups.set(day, [item]);
  }
  return [...groups].map(([day, dayItems]) => {
    const first = new Date(dayItems[0]?.createdAt ?? now);
    let title: string;
    if (day === today) title = "Сегодня";
    else if (day === yesterday) title = "Вчера";
    else if (day.slice(0, 4) === today.slice(0, 4)) title = dayMonth.format(first);
    else title = dayMonthYear.format(first);
    return { title, items: dayItems };
  });
}

/** Время внутри группы: «только что», «5 мин назад», «2 ч назад» (до 6 часов), дальше «14:05». */
export function formatTime(iso: string, now: Date): string {
  const at = new Date(iso);
  const minutes = Math.floor((now.getTime() - at.getTime()) / 60_000);
  if (minutes >= 0 && minutes < 1) return "только что";
  if (minutes >= 1 && minutes < 60) return `${minutes} мин назад`;
  if (minutes >= 60 && minutes < 6 * 60) return `${Math.floor(minutes / 60)} ч назад`;
  return clock.format(at);
}

/** Число на бейдже навигации: `0` → `null` (бейдж не показываем), больше 9 → «9+». */
export function badgeText(count: number): string | null {
  if (count <= 0) return null;
  return count > 9 ? "9+" : String(count);
}

/** «1 непрочитанное», «3 непрочитанных», «Всё прочитано» — подпись под заголовком и `aria-label`. */
export function unreadLabel(count: number): string {
  if (count <= 0) return "Всё прочитано";
  const mod10 = count % 10;
  const mod100 = count % 100;
  const word = mod10 === 1 && mod100 !== 11 ? "непрочитанное" : "непрочитанных";
  return `${count} ${word}`;
}
