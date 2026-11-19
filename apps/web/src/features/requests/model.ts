// Чистая логика заявок без React: подписи типов и статусов, мастер подачи, порядок, даты.
// Её же использует кабинет сотрудника деканата (#18). Даты и время — по Москве.
import type {
  RequestCategory,
  RequestListItem,
  RequestStatus,
  RequestStatusChange,
  RequestType,
} from "@aihs/contract";
import type { BadgeTone } from "../../ui";

/** Шаги мастера подачи: тип → детали → подтверждение. */
export type WizardStep = "type" | "details" | "confirm";

/** «Справка об обучении», «Заявление на пересдачу»… */
export function requestTypeLabel(_type: RequestType): string {
  throw new Error("not implemented");
}

/** Короткое пояснение под типом в мастере: зачем документ и сколько его ждать. */
export function requestTypeHint(_type: RequestType): string {
  throw new Error("not implemented");
}

/** «Справки» / «Заявления» — заголовки групп в мастере. */
export function requestCategoryLabel(_category: RequestCategory): string {
  throw new Error("not implemented");
}

/** Типы по группам в порядке показа: сначала справки, потом заявления. */
export function requestTypesByCategory(): { category: RequestCategory; types: RequestType[] }[] {
  throw new Error("not implemented");
}

/**
 * Подпись и тон бейджа статуса: «Подана» (neutral), «На рассмотрении» (info),
 * «Готова» (success), «Отклонена» (danger). В UI рядом всегда иконка, не только цвет.
 */
export function requestStatusView(_status: RequestStatus): { label: string; tone: BadgeTone } {
  throw new Error("not implemented");
}

/** Поле «Пояснение» на шаге «Детали»: для заявлений обязательно, для справок нет. */
export function commentField(_type: RequestType): {
  required: boolean;
  label: string;
  placeholder: string;
} {
  throw new Error("not implemented");
}

/**
 * Ошибка поля «Пояснение» или `null`. Пустое при обязательном — просьба описать;
 * длиннее 1000 символов (лимит контракта) — «Не больше 1000 символов».
 */
export function validateComment(_type: RequestType, _comment: string): string | null {
  throw new Error("not implemented");
}

/** Активные (подана, на рассмотрении) сверху, затем остальные; внутри — свежие сверху по `updatedAt`. */
export function sortRequests(_items: readonly RequestListItem[]): RequestListItem[] {
  throw new Error("not implemented");
}

/** История статусов по времени, старые сверху: таймлайн читается сверху вниз. */
export function timeline(_history: readonly RequestStatusChange[]): RequestStatusChange[] {
  throw new Error("not implemented");
}

/** «19 ноября, 14:05» по Москве; год добавляется, если он не совпадает с годом `now`. */
export function formatDateTime(_iso: string, _now: Date): string {
  throw new Error("not implemented");
}
