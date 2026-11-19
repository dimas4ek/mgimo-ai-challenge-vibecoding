import { useMe, useNotifications } from "../../api";
import { cn } from "../../lib/cn";
import { badgeText, unreadLabel } from "./model";

/**
 * Число непрочитанных для навигации: сайдбар, колокольчик в шапке, вкладка «Ещё».
 * Запрашивает ленту только у студента (у сотрудника эндпоинт закрыт). `undefined` — пока не знаем.
 */
export function useUnreadCount(): number | undefined {
  const me = useMe();
  const notifications = useNotifications({ enabled: me.data?.role === "student" });
  return notifications.data?.unreadCount;
}

type UnreadBadgeProps = {
  /** Как прикрепить: `dot` — кружок на иконке (колокольчик, таб), `inline` — справа от подписи. */
  variant?: "dot" | "inline";
  className?: string;
  /**
   * Добавить текст для скринридера «, 2 непрочитанных» (по умолчанию да). Если кружок стоит
   * на иконке перед подписью, ставь `announce={false}`, а текст — `<UnreadCountText />` после подписи.
   */
  announce?: boolean;
};

/**
 * Бейдж с числом непрочитанных (`badgeText`). Ничего не рисует, если непрочитанных нет.
 * Число дублируется для скринридера через `unreadLabel`, обновляется после `useMarkRead`.
 */
export function UnreadBadge({ variant = "inline", className, announce = true }: UnreadBadgeProps) {
  const count = useUnreadCount() ?? 0;
  const text = badgeText(count);
  if (!text) return null;
  return (
    <>
      <span
        aria-hidden
        className={cn(
          "grid min-w-5 place-items-center rounded-full bg-danger px-1.5 text-xs leading-5 font-semibold text-primary-foreground tabular-nums",
          variant === "dot" && "absolute -top-1 -right-1 ring-2 ring-surface",
          variant === "inline" && "ml-auto",
          className,
        )}
      >
        {text}
      </span>
      {announce && <UnreadCountText />}
    </>
  );
}

/** Только текст для скринридера: «, 2 непрочитанных». Пусто, если непрочитанных нет. */
export function UnreadCountText() {
  const count = useUnreadCount() ?? 0;
  if (count <= 0) return null;
  return <span className="sr-only">, {unreadLabel(count)}</span>;
}
