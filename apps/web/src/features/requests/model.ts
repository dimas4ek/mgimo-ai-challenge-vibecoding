// Чистая логика заявок без React: подписи типов и статусов, мастер подачи, порядок, даты.
// Её же использует кабинет сотрудника деканата (#18). Даты и время — по Москве.
import {
  REQUEST_CATEGORY,
  type RequestCategory,
  type RequestListItem,
  type RequestStatus,
  type RequestStatusChange,
  type RequestType,
} from "@aihs/contract";
import type { BadgeTone } from "../../ui";

/** Шаги мастера подачи: тип → детали → подтверждение. */
export type WizardStep = "type" | "details" | "confirm";

/** Лимит пояснения из контракта (`CreateRequestInputSchema`). */
export const COMMENT_MAX = 1000;

const typeView: Record<RequestType, { label: string; hint: string }> = {
  enrollment_certificate: {
    label: "Справка об обучении",
    hint: "Подтверждает, что вы учитесь. Обычно готова за 1–2 рабочих дня.",
  },
  scholarship_certificate: {
    label: "Справка о стипендии",
    hint: "Размер стипендии за последние месяцы. 2–3 рабочих дня.",
  },
  military_registration_certificate: {
    label: "Справка для военкомата",
    hint: "По форме для воинского учёта. 2–3 рабочих дня.",
  },
  transcript: {
    label: "Выписка с оценками",
    hint: "Все оценки за время учёбы. До 5 рабочих дней.",
  },
  retake_application: {
    label: "Заявление на пересдачу",
    hint: "Укажите дисциплину — деканат назначит дату.",
  },
  academic_leave_application: {
    label: "Заявление на академический отпуск",
    hint: "Решение — до 10 рабочих дней.",
  },
  individual_schedule_application: {
    label: "Заявление на индивидуальный график",
    hint: "Если совмещаете учёбу с работой или есть другая причина.",
  },
};

/** «Справка об обучении», «Заявление на пересдачу»… */
export function requestTypeLabel(type: RequestType): string {
  return typeView[type].label;
}

/** Короткое пояснение под типом в мастере: зачем документ и сколько его ждать. */
export function requestTypeHint(type: RequestType): string {
  return typeView[type].hint;
}

const categoryLabel: Record<RequestCategory, string> = {
  certificate: "Справки",
  application: "Заявления",
};

/** «Справки» / «Заявления» — заголовки групп в мастере. */
export function requestCategoryLabel(category: RequestCategory): string {
  return categoryLabel[category];
}

/** Типы по группам в порядке показа: сначала справки, потом заявления. */
export function requestTypesByCategory(): { category: RequestCategory; types: RequestType[] }[] {
  const all = Object.keys(REQUEST_CATEGORY) as RequestType[];
  return (["certificate", "application"] as const).map((category) => ({
    category,
    types: all.filter((type) => REQUEST_CATEGORY[type] === category),
  }));
}

const statusView: Record<RequestStatus, { label: string; tone: BadgeTone }> = {
  submitted: { label: "Подана", tone: "neutral" },
  in_review: { label: "На рассмотрении", tone: "info" },
  ready: { label: "Готова", tone: "success" },
  rejected: { label: "Отклонена", tone: "danger" },
};

/**
 * Подпись и тон бейджа статуса: «Подана» (neutral), «На рассмотрении» (info),
 * «Готова» (success), «Отклонена» (danger). В UI рядом всегда иконка, не только цвет.
 */
export function requestStatusView(status: RequestStatus): { label: string; tone: BadgeTone } {
  return statusView[status];
}

const commentView: Record<RequestType, { label: string; placeholder: string }> = {
  enrollment_certificate: {
    label: "Куда нужна справка",
    placeholder: "Например: по месту работы родителей",
  },
  scholarship_certificate: {
    label: "Куда нужна справка",
    placeholder: "Например: в соцзащиту",
  },
  military_registration_certificate: {
    label: "Куда нужна справка",
    placeholder: "Например: в военкомат по месту жительства",
  },
  transcript: {
    label: "Куда нужна выписка",
    placeholder: "Например: для стажировки",
  },
  retake_application: {
    label: "Дисциплина и причина",
    placeholder: "Например: Теория вероятностей, болел в день экзамена",
  },
  academic_leave_application: {
    label: "Причина и с какого числа",
    placeholder: "Например: по состоянию здоровья, с 1 февраля",
  },
  individual_schedule_application: {
    label: "Причина и период",
    placeholder: "Например: работа по специальности, весенний семестр",
  },
};

/** Поле «Пояснение» на шаге «Детали»: для заявлений обязательно, для справок нет. */
export function commentField(type: RequestType): {
  required: boolean;
  label: string;
  placeholder: string;
} {
  return { required: REQUEST_CATEGORY[type] === "application", ...commentView[type] };
}

/**
 * Ошибка поля «Пояснение» или `null`. Пустое при обязательном — просьба описать;
 * длиннее 1000 символов (лимит контракта) — «Не больше 1000 символов».
 */
export function validateComment(type: RequestType, comment: string): string | null {
  const text = comment.trim();
  if (commentField(type).required && text === "") {
    return "Опишите, что нужно: без этого деканат не сможет рассмотреть заявление";
  }
  if (text.length > COMMENT_MAX) return `Не больше ${COMMENT_MAX} символов`;
  return null;
}

const isActive = (status: RequestStatus) => status === "submitted" || status === "in_review";

/** Активные (подана, на рассмотрении) сверху, затем остальные; внутри — свежие сверху по `updatedAt`. */
export function sortRequests(items: readonly RequestListItem[]): RequestListItem[] {
  return [...items].sort(
    (a, b) =>
      Number(isActive(b.status)) - Number(isActive(a.status)) ||
      Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  );
}

/** История статусов по времени, старые сверху: таймлайн читается сверху вниз. */
export function timeline(history: readonly RequestStatusChange[]): RequestStatusChange[] {
  return [...history].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

const TZ = "Europe/Moscow";
const dayMonth = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: TZ });
const dayMonthYear = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: TZ,
});
const time = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: TZ,
});
const year = new Intl.DateTimeFormat("en-CA", { year: "numeric", timeZone: TZ });

/** «19 ноября, 14:05» по Москве; год добавляется, если он не совпадает с годом `now`. */
export function formatDateTime(iso: string, now: Date): string {
  const at = new Date(iso);
  const date = year.format(at) === year.format(now) ? dayMonth : dayMonthYear;
  return `${date.format(at)}, ${time.format(at)}`;
}
