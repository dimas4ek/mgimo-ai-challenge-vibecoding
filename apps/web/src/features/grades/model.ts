// Чистая логика экрана успеваемости без React: подписи, статус дисциплины, сроки сессии.
// Её же использует калькулятор «что нужно для стипендии / закрыть сессию» (#24).
// Даты — по Москве, а не по часам устройства.
import type { ControlForm, DisciplineGrade, ExamSession, GradeResult } from "@aihs/contract";
import type { BadgeTone } from "../../ui";

/** Состояние дисциплины для студента: закрыта, долг или итога ещё нет. */
export type DisciplineState = "passed" | "debt" | "pending";

const CONTROL_FORM: Record<ControlForm, string> = {
  exam: "Экзамен",
  credit: "Зачёт",
  graded_credit: "Дифф. зачёт",
};

const RESULT: Record<GradeResult, { label: string; tone: BadgeTone }> = {
  excellent: { label: "Отлично", tone: "success" },
  good: { label: "Хорошо", tone: "success" },
  satisfactory: { label: "Удовлетворительно", tone: "warning" },
  unsatisfactory: { label: "Неудовлетворительно", tone: "danger" },
  passed: { label: "Зачтено", tone: "success" },
  failed: { label: "Не зачтено", tone: "danger" },
  pending: { label: "Нет итога", tone: "neutral" },
};

/** «Экзамен», «Зачёт», «Дифф. зачёт». */
export function controlFormLabel(form: ControlForm): string {
  return CONTROL_FORM[form];
}

/** Подпись и тон бейджа итога: «Отлично» (success), «Не зачтено» (danger), «Нет итога» (neutral)… */
export function resultLabel(result: GradeResult): { label: string; tone: BadgeTone } {
  return RESULT[result];
}

/** Закрыта (положительный итог), долг (`unsatisfactory`/`failed`) или итога нет (`pending`). */
export function disciplineState(d: DisciplineGrade): DisciplineState {
  if (d.result === "pending") return "pending";
  return d.result === "unsatisfactory" || d.result === "failed" ? "debt" : "passed";
}

const STATE_ORDER: Record<DisciplineState, number> = { debt: 0, pending: 1, passed: 2 };

/** Порядок на экране: сначала долги, потом без итога, потом закрытые; внутри — по названию. */
export function sortForDisplay(disciplines: readonly DisciplineGrade[]): DisciplineGrade[] {
  return [...disciplines].sort(
    (a, b) =>
      STATE_ORDER[disciplineState(a)] - STATE_ORDER[disciplineState(b)] ||
      a.subject.localeCompare(b.subject, "ru"),
  );
}

// Календарные даты `YYYY-MM-DD` сравниваем как полночь UTC: от зоны устройства не зависит.
const utc = (isoDate: string) => Date.parse(`${isoDate}T00:00:00Z`);
const DAY = 86_400_000;

const dayMonth = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const dayOnly = new Intl.DateTimeFormat("ru-RU", { day: "numeric", timeZone: "UTC" });
const moscowDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Moscow",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** «28 декабря – 24 января»; в одном месяце — «8–30 июня». */
export function formatSessionRange(session: ExamSession): string {
  const start = new Date(utc(session.startDate));
  const end = new Date(utc(session.endDate));
  const sameMonth =
    start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear();
  return sameMonth
    ? `${dayOnly.format(start)}–${dayMonth.format(end)}`
    : `${dayMonth.format(start)} – ${dayMonth.format(end)}`;
}

/**
 * Где сессия относительно `now` (по Москве): `before` с числом дней до начала,
 * `ongoing` (идёт, включая первый и последний день) или `after`.
 */
export function sessionPhase(
  session: ExamSession,
  now: Date,
): { phase: "before"; daysLeft: number } | { phase: "ongoing" } | { phase: "after" } {
  const today = utc(moscowDate.format(now));
  const start = utc(session.startDate);
  if (today < start) return { phase: "before", daysLeft: Math.round((start - today) / DAY) };
  return today <= utc(session.endDate) ? { phase: "ongoing" } : { phase: "after" };
}

/** «1 день», «3 дня», «12 дней» — склонение по числу. */
export function pluralDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  let word = "дней";
  if (mod10 === 1 && mod100 !== 11) word = "день";
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) word = "дня";
  return `${n} ${word}`;
}
