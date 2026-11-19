/**
 * Пути страниц SPA. Ссылки строим только отсюда (`paths.request("…")`), строки руками не пишем.
 * Пути API — в `@aihs/contract` (`routes`), это другое.
 */
export const paths = {
  login: "/login",
  home: "/",
  schedule: "/schedule",
  grades: "/grades",
  requests: "/requests",
  /** Шаблон для роутера; ссылку строй через `paths.request(id)`. */
  requestPattern: "/requests/:id",
  request: (id: string) => `/requests/${encodeURIComponent(id)}`,
  notifications: "/notifications",
  profile: "/profile",
  /** Таб «Ещё» на телефоне: уведомления, профиль, тема, выход. */
  more: "/more",
  staff: "/staff",
} as const;
