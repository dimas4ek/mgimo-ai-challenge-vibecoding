import type { ReactNode } from "react";

/**
 * Число непрочитанных для навигации: сайдбар, колокольчик в шапке, вкладка «Ещё».
 * Запрашивает ленту только у студента (у сотрудника эндпоинт закрыт). `undefined` — пока не знаем.
 */
export function useUnreadCount(): number | undefined {
  throw new Error("not implemented");
}

type UnreadBadgeProps = {
  /** Как прикрепить: `dot` — кружок на иконке (колокольчик, таб), `inline` — справа от подписи. */
  variant?: "dot" | "inline";
  className?: string;
};

/**
 * Бейдж с числом непрочитанных (`badgeText`). Ничего не рисует, если непрочитанных нет.
 * Число дублируется для скринридера через `unreadLabel`, обновляется после `useMarkRead`.
 */
export function UnreadBadge(_props: UnreadBadgeProps): ReactNode {
  throw new Error("not implemented");
}
