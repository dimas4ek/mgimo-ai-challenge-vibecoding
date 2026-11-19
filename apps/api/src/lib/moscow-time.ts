// Даты считаем в Europe/Moscow явно и не зависим от таймзоны машины (.claude/rules/cross-platform.md).

/** Календарная дата `YYYY-MM-DD` момента `now` по Москве. */
export function moscowDate(now: Date): string {
  void now;
  throw new Error("not implemented");
}

/** Понедельник недели, в которую попадает дата `YYYY-MM-DD`. */
export function mondayOf(isoDate: string): string {
  void isoDate;
  throw new Error("not implemented");
}

/** Дата `YYYY-MM-DD`, сдвинутая на `days` календарных дней (можно отрицательно). */
export function addDays(isoDate: string, days: number): string {
  void isoDate;
  void days;
  throw new Error("not implemented");
}

/** Момент времени для московских даты `YYYY-MM-DD` и времени `HH:MM`. */
export function moscowDateTime(isoDate: string, time: string): Date {
  void isoDate;
  void time;
  throw new Error("not implemented");
}
