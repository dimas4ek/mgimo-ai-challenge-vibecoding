/**
 * Пути страниц SPA. Ссылки строим только отсюда (`paths.request("…")`), строки руками не пишем.
 * Пути API — в `@aihs/contract` (`routes`), это другое.
 */
export const paths = {
  login: "/login",
  home: "/",
  schedule: "/schedule",
  grades: "/grades",
  curriculum: ({ semester, subject }: { semester?: string; subject?: string } = {}) => {
    const params = new URLSearchParams({ tab: "disciplines" });
    if (semester) params.set("semester", semester);
    if (subject) params.set("subject", subject);
    return `/grades?${params}`;
  },
  discussions: "/discussions",
  /** Шаблон для роутера; ссылку строй через `paths.discussion(id)`. */
  discussionPattern: "/discussions/:id",
  discussion: (id: string) => `/discussions/${encodeURIComponent(id)}`,
  requests: "/requests",
  /** Шаблон для роутера; ссылку строй через `paths.request(id)`. */
  requestPattern: "/requests/:id",
  request: (id: string) => `/requests/${encodeURIComponent(id)}`,
  notifications: "/notifications",
  profile: "/profile",
  group: "/group",
  /** Таб «Ещё» на телефоне: уведомления, профиль, тема, выход. */
  more: "/more",
  staff: "/staff",
  /** Справка для печати с QR (без AppShell, для печати). Наполняет #26. */
  certificatePattern: "/requests/:id/certificate",
  certificate: (requestId: string) => `/requests/${encodeURIComponent(requestId)}/certificate`,
  /** Публичная проверка справки по QR, без входа и без AppShell. Наполняет #26. */
  verifyPattern: "/verify/:token",
  verify: (token: string) => `/verify/${encodeURIComponent(token)}`,
} as const;

/** Разделы, которые на телефоне открываются из вкладки «Ещё» (для её подсветки). */
export const morePaths: readonly string[] = [
  paths.more,
  paths.notifications,
  paths.profile,
  paths.group,
  paths.discussions,
];
