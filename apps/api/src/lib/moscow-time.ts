// Даты считаем в Europe/Moscow явно и не зависим от таймзоны машины (.claude/rules/cross-platform.md).
// Календарные даты `YYYY-MM-DD` двигаем как полночь UTC: так сдвиг на день не зависит от зоны.

const TIME_ZONE = "Europe/Moscow";

const dateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const offsetFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  timeZoneName: "longOffset",
});

const toUtcMidnight = (isoDate: string) => new Date(`${isoDate}T00:00:00.000Z`);
const fromUtcMidnight = (d: Date) => d.toISOString().slice(0, 10);

/** Календарная дата `YYYY-MM-DD` момента `now` по Москве. */
export function moscowDate(now: Date): string {
  const parts = Object.fromEntries(dateFormat.formatToParts(now).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Понедельник недели, в которую попадает дата `YYYY-MM-DD`. */
export function mondayOf(isoDate: string): string {
  const daysSinceMonday = (toUtcMidnight(isoDate).getUTCDay() + 6) % 7;
  return addDays(isoDate, -daysSinceMonday);
}

/** Дата `YYYY-MM-DD`, сдвинутая на `days` календарных дней (можно отрицательно). */
export function addDays(isoDate: string, days: number): string {
  const d = toUtcMidnight(isoDate);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtcMidnight(d);
}

/** Момент времени для московских даты `YYYY-MM-DD` и времени `HH:MM`. */
export function moscowDateTime(isoDate: string, time: string): Date {
  // Смещение зоны на эту дату, например "GMT+03:00". Полдень UTC — заведомо внутри нужных суток.
  const name = offsetFormat
    .formatToParts(new Date(`${isoDate}T12:00:00.000Z`))
    .find((p) => p.type === "timeZoneName")?.value;
  const offset = !name || name === "GMT" ? "+00:00" : name.slice(3);
  return new Date(`${isoDate}T${time}:00.000${offset}`);
}
