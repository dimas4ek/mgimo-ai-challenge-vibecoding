// Чистая логика справок без React: даты по Москве и адрес страницы проверки для QR.

const dateMsk = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Moscow",
});
const dateUtc = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** Момент выдачи → «13 ноября 2026 г.» по Москве. */
export function formatIssuedAt(iso: string): string {
  return dateMsk.format(new Date(iso));
}

/** Календарная дата `YYYY-MM-DD` (уже по Москве) → «13 ноября 2026 г.». */
export function formatIssuedOn(isoDate: string): string {
  return dateUtc.format(new Date(`${isoDate}T00:00:00Z`));
}

/** Полный адрес страницы проверки для QR: origin сайта + `verifyPath` из API. */
export function verifyUrl(verifyPath: string, origin: string): string {
  return new URL(verifyPath, origin).toString();
}
