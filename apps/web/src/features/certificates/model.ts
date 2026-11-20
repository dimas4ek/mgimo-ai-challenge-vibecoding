// Чистая логика справок без React: даты по Москве и адрес страницы проверки для QR.
import type { CertificateGrade, RequestType } from "@aihs/contract";

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

const enrolled =
  "AI High School (Высшая Школа ИИ) подтверждает, что указанное лицо обучается в вузе.";

const statement: Partial<Record<RequestType, string>> = {
  enrollment_certificate: enrolled,
  scholarship_certificate: `${enrolled} Справка выдана для оформления стипендии и других выплат.`,
  military_registration_certificate: `${enrolled} Справка выдана для предъявления в военный комиссариат по месту воинского учёта.`,
  transcript: `${enrolled} Выписка выдана по данным зачётной книжки.`,
};

/** Текст справки под заголовком: у каждого типа своё назначение. */
export function certificateStatement(type: RequestType): string {
  return statement[type] ?? enrolled;
}

/** Оценки выписки по семестрам в порядке из API (он уже хронологический). */
export function groupBySemester(
  grades: readonly CertificateGrade[],
): { semester: string; items: CertificateGrade[] }[] {
  const groups: { semester: string; items: CertificateGrade[] }[] = [];
  for (const g of grades) {
    const last = groups.at(-1);
    if (last?.semester === g.semester) last.items.push(g);
    else groups.push({ semester: g.semester, items: [g] });
  }
  return groups;
}

/** Полный адрес страницы проверки для QR: origin сайта + `verifyPath` из API. */
export function verifyUrl(verifyPath: string, origin: string): string {
  return new URL(verifyPath, origin).toString();
}
