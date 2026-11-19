// Чистая логика кабинета сотрудника без React: фильтр очереди, порядок, допустимые переходы статуса.
// Подписи типов и статусов — общие с экраном студента, из `features/requests/model.ts`.
import {
  type ChangeStatusInput,
  type RequestStatus,
  RequestStatusSchema,
  type StaffRequestItem,
} from "@aihs/contract";

/** Фильтр очереди: конкретный статус или все заявки. В адресе — `?status=in_review`. */
export type StaffFilter = RequestStatus | "all";

/** Статус, в который сотрудник может перевести заявку (вернуть в `submitted` нельзя). */
export type TargetStatus = ChangeStatusInput["status"];

/** Лимит комментария из контракта (`ChangeStatusInputSchema`). */
const COMMENT_MAX = 1000;

const filterOptions: { value: StaffFilter; label: string }[] = [
  { value: "submitted", label: "Новые" },
  { value: "in_review", label: "В работе" },
  { value: "ready", label: "Готовые" },
  { value: "rejected", label: "Отклонённые" },
  { value: "all", label: "Все" },
];

/** Кнопки фильтра в порядке показа: «Новые», «В работе», «Готовые», «Отклонённые», «Все». */
export function staffFilterOptions(): { value: StaffFilter; label: string }[] {
  return filterOptions;
}

/** Фильтр из адреса; неизвестное значение или его отсутствие → `submitted` (новые — главная очередь). */
export function parseStaffFilter(param: string | null): StaffFilter {
  if (param === "all") return "all";
  const status = RequestStatusSchema.safeParse(param);
  return status.success ? status.data : "submitted";
}

const transitions: Record<RequestStatus, TargetStatus[]> = {
  submitted: ["in_review", "ready", "rejected"],
  in_review: ["ready", "rejected"],
  ready: [],
  rejected: [],
};

/**
 * Куда можно перевести заявку: из «Подана» — в работу, готово или отказ; из «На рассмотрении» —
 * готово или отказ; «Готова» и «Отклонена» — финальные, переходов нет (`[]`).
 */
export function nextStatuses(current: RequestStatus): TargetStatus[] {
  return transitions[current];
}

const actionLabel: Record<TargetStatus, string> = {
  in_review: "Взять в работу",
  ready: "Готово",
  rejected: "Отклонить",
};

/** Подпись кнопки перехода: «Взять в работу», «Готово», «Отклонить». */
export function statusActionLabel(status: TargetStatus): string {
  return actionLabel[status];
}

/**
 * Ошибка комментария к смене статуса или `null`. При отказе комментарий обязателен
 * (студент должен понять причину); длиннее 1000 символов — «Не больше 1000 символов».
 */
export function validateStaffComment(status: TargetStatus, comment: string): string | null {
  const text = comment.trim();
  if (status === "rejected" && text === "") return "Напишите причину отказа — её увидит студент";
  if (text.length > COMMENT_MAX) return `Не больше ${COMMENT_MAX} символов`;
  return null;
}

const isActive = (status: RequestStatus) => status === "submitted" || status === "in_review";

/** Очередь: активные — старые сверху (кто раньше подал, того раньше и смотрим); финальные — свежие сверху. */
export function sortQueue(items: readonly StaffRequestItem[]): StaffRequestItem[] {
  return [...items].sort((a, b) => {
    const active = Number(isActive(b.status)) - Number(isActive(a.status));
    if (active !== 0) return active;
    return isActive(a.status)
      ? Date.parse(a.createdAt) - Date.parse(b.createdAt)
      : Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  });
}
