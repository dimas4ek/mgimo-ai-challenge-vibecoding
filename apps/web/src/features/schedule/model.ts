// Чистая логика расписания без React: что показать «сегодня», какая пара ближайшая, куда листать неделю.
// Её же использует главная «Сегодня» (#21). Даты и время — всегда по Москве, а не по часам устройства.
import type { Lesson, LessonChangeKind, LessonType } from "@aihs/contract";

/** Дата `YYYY-MM-DD` по Москве. */
export type IsoDate = string;

/** Календарная дата момента `now` по Москве: `2026-11-19`. */
export function moscowToday(_now: Date): IsoDate {
  throw new Error("not implemented");
}

/** Время `HH:MM` момента `now` по Москве. */
export function moscowTime(_now: Date): string {
  throw new Error("not implemented");
}

/** Сдвиг даты на `days` дней: `addDays("2026-11-16", 7)` → `"2026-11-23"`. */
export function addDays(_date: IsoDate, _days: number): IsoDate {
  throw new Error("not implemented");
}

/** Понедельник недели, в которую попадает дата. */
export function mondayOf(_date: IsoDate): IsoDate {
  throw new Error("not implemented");
}

/** Пары одного дня в порядке начала (отменённые тоже: их показываем зачёркнутыми). */
export function lessonsOn(_lessons: readonly Lesson[], _date: IsoDate): Lesson[] {
  throw new Error("not implemented");
}

/** Дни недели с парами: `[{ date, lessons }]` по порядку, дни без пар пропускаются. */
export function groupByDay(_lessons: readonly Lesson[]): { date: IsoDate; lessons: Lesson[] }[] {
  throw new Error("not implemented");
}

/**
 * Ближайшая пара: идёт сейчас или начнётся позже `now` (по Москве). Отменённые пропускаются.
 * Нет такой в переданном списке → `null` (тогда UI смотрит следующую неделю).
 */
export function nextLesson(_lessons: readonly Lesson[], _now: Date): Lesson | null {
  throw new Error("not implemented");
}

/** Пара идёт прямо сейчас. */
export function isOngoing(_lesson: Lesson, _now: Date): boolean {
  throw new Error("not implemented");
}

/** «Понедельник, 16 ноября». */
export function formatDayTitle(_date: IsoDate): string {
  throw new Error("not implemented");
}

/** «16–22 ноября» или «30 ноября – 6 декабря». */
export function formatWeekRange(_weekStart: IsoDate, _weekEnd: IsoDate): string {
  throw new Error("not implemented");
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
