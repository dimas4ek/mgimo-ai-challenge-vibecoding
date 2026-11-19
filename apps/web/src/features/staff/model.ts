// Чистая логика кабинета сотрудника без React: фильтр очереди, порядок, допустимые переходы статуса.
// Подписи типов и статусов — общие с экраном студента, из `features/requests/model.ts`.
import type { ChangeStatusInput, RequestStatus, StaffRequestItem } from "@aihs/contract";

/** Фильтр очереди: конкретный статус или все заявки. В адресе — `?status=in_review`. */
export type StaffFilter = RequestStatus | "all";

/** Статус, в который сотрудник может перевести заявку (вернуть в `submitted` нельзя). */
export type TargetStatus = ChangeStatusInput["status"];

/** Кнопки фильтра в порядке показа: «Новые», «В работе», «Готовые», «Отклонённые», «Все». */
export function staffFilterOptions(): { value: StaffFilter; label: string }[] {
  throw new Error("not implemented");
}

/** Фильтр из адреса; неизвестное значение или его отсутствие → `submitted` (новые — главная очередь). */
export function parseStaffFilter(_param: string | null): StaffFilter {
  throw new Error("not implemented");
}

/**
 * Куда можно перевести заявку: из «Подана» — в работу, готово или отказ; из «На рассмотрении» —
 * готово или отказ; «Готова» и «Отклонена» — финальные, переходов нет (`[]`).
 */
export function nextStatuses(_current: RequestStatus): TargetStatus[] {
  throw new Error("not implemented");
}

/** Подпись кнопки перехода: «Взять в работу», «Готово», «Отклонить». */
export function statusActionLabel(_status: TargetStatus): string {
  throw new Error("not implemented");
}

/**
 * Ошибка комментария к смене статуса или `null`. При отказе комментарий обязателен
 * (студент должен понять причину); длиннее 1000 символов — «Не больше 1000 символов».
 */
export function validateStaffComment(_status: TargetStatus, _comment: string): string | null {
  throw new Error("not implemented");
}

/** Очередь: активные — старые сверху (кто раньше подал, того раньше и смотрим); финальные — свежие сверху. */
export function sortQueue(_items: readonly StaffRequestItem[]): StaffRequestItem[] {
  throw new Error("not implemented");
}
