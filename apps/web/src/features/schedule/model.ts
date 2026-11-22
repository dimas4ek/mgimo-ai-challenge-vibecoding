// Чистая логика расписания без React: что показать «сегодня», какая пара ближайшая, куда листать неделю.
// Её же использует главная «Сегодня» (#21). Даты и время — всегда по Москве, а не по часам устройства.
import type { Lesson, LessonChangeKind, LessonType } from "@aihs/contract";

/** Дата `YYYY-MM-DD` по Москве. */
export type IsoDate = string;

/** Возвращает дату из параметра week, если её принимает API расписания. */
export function parseScheduleWeek(_value: string | null): IsoDate | null {
  throw new Error("not implemented");
}

const TZ = "Europe/Moscow";

const moscowParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function partsOf(now: Date): Record<string, string> {
  return Object.fromEntries(moscowParts.formatToParts(now).map((p) => [p.type, p.value]));
}

/** Календарная дата момента `now` по Москве: `2026-11-19`. */
export function moscowToday(now: Date): IsoDate {
  const p = partsOf(now);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Время `HH:MM` момента `now` по Москве. */
export function moscowTime(now: Date): string {
  const p = partsOf(now);
  return `${p.hour}:${p.minute}`;
}

// Арифметика дат идёт в UTC-полночи: так переход на летнее время машины ничего не сдвигает.
const toUtc = (date: IsoDate) => new Date(`${date}T00:00:00.000Z`);
const fromUtc = (d: Date): IsoDate => d.toISOString().slice(0, 10);

/** Сдвиг даты на `days` дней: `addDays("2026-11-16", 7)` → `"2026-11-23"`. */
export function addDays(date: IsoDate, days: number): IsoDate {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

/** Понедельник недели, в которую попадает дата. */
export function mondayOf(date: IsoDate): IsoDate {
  const sinceMonday = (toUtc(date).getUTCDay() + 6) % 7;
  return addDays(date, -sinceMonday);
}

const byStart = (a: Lesson, b: Lesson) =>
  a.date === b.date ? a.start.localeCompare(b.start) : a.date.localeCompare(b.date);

/** Пары одного дня в порядке начала (отменённые тоже: их показываем зачёркнутыми). */
export function lessonsOn(lessons: readonly Lesson[], date: IsoDate): Lesson[] {
  return lessons.filter((l) => l.date === date).sort(byStart);
}

/** Дни недели с парами: `[{ date, lessons }]` по порядку, дни без пар пропускаются. */
export function groupByDay(lessons: readonly Lesson[]): { date: IsoDate; lessons: Lesson[] }[] {
  const days = new Map<IsoDate, Lesson[]>();
  for (const lesson of [...lessons].sort(byStart)) {
    const day = days.get(lesson.date);
    if (day) day.push(lesson);
    else days.set(lesson.date, [lesson]);
  }
  return [...days].map(([date, dayLessons]) => ({ date, lessons: dayLessons }));
}

/** Пара идёт прямо сейчас. */
export function isOngoing(lesson: Lesson, now: Date): boolean {
  if (lesson.change?.kind === "cancelled" || lesson.date !== moscowToday(now)) return false;
  const time = moscowTime(now);
  return lesson.start <= time && time < lesson.end;
}

/**
 * Ближайшая пара: идёт сейчас или начнётся позже `now` (по Москве). Отменённые пропускаются.
 * Нет такой в переданном списке → `null` (тогда UI смотрит следующую неделю).
 */
export function nextLesson(lessons: readonly Lesson[], now: Date): Lesson | null {
  const today = moscowToday(now);
  const time = moscowTime(now);
  return (
    [...lessons]
      .sort(byStart)
      .find(
        (l) =>
          l.change?.kind !== "cancelled" && (l.date > today || (l.date === today && l.end > time)),
      ) ?? null
  );
}

const weekday = new Intl.DateTimeFormat("ru-RU", { weekday: "long", timeZone: "UTC" });
const dayMonth = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** «Понедельник, 16 ноября». */
export function formatDayTitle(date: IsoDate): string {
  const d = toUtc(date);
  return `${capitalize(weekday.format(d))}, ${dayMonth.format(d)}`;
}

/** «16–22 ноября» или «30 ноября – 6 декабря». */
export function formatWeekRange(weekStart: IsoDate, weekEnd: IsoDate): string {
  const start = toUtc(weekStart);
  const end = toUtc(weekEnd);
  if (start.getUTCMonth() === end.getUTCMonth()) {
    return `${start.getUTCDate()}–${dayMonth.format(end)}`;
  }
  return `${dayMonth.format(start)} – ${dayMonth.format(end)}`;
}

/** Подписи типов пар (в контракте только коды). */
export const lessonTypeLabel: Record<LessonType, string> = {
  lecture: "Лекция",
  seminar: "Семинар",
  lab: "Лабораторная",
  consultation: "Консультация",
  exam: "Экзамен",
};

/** Подписи изменений пары: в UI всегда текст плюс иконка, а не только цвет. */
export const lessonChangeLabel: Record<LessonChangeKind, string> = {
  moved: "Перенос",
  replaced: "Замена",
  cancelled: "Отменена",
};
