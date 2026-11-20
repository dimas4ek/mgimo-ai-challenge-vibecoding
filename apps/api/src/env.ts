import type { Role } from "@aihs/contract";
import type { Db } from "./db/client";

/** Пользователь текущей сессии. Кладёт `requireAuth`, читают все роуты под `/api/me/*` и `/api/staff/*`. */
export interface SessionUser {
  /** id из таблицы users. */
  id: string;
  role: Role;
  displayName: string;
  /** id из таблицы students; у сотрудника `null`. Единственный источник id студента для `/api/me/*`. */
  studentId: string | null;
}

/** Зависимости приложения. Тесты передают PGlite в памяти и фиксированное время. */
export interface AppDeps {
  db: Db;
  /** Текущее время. По умолчанию `() => new Date()`. */
  now?: () => Date;
  /** Флаг `Secure` у cookie сессии. По умолчанию — только в `NODE_ENV=production`. */
  secureCookies?: boolean;
  /** Лимит неудачных входов с одного адреса за окно. По умолчанию 10 за 15 минут. */
  loginRateLimit?: { max: number; windowMs: number };
  /**
   * Заголовок с адресом клиента для rate-limit входа (`CLIENT_IP_HEADER`), например `cf-connecting-ip`
   * за Cloudflare на Render. Задан — адрес берётся только из него, `X-Forwarded-For` игнорируется.
   * Не задан — последний адрес `X-Forwarded-For` (его дописывает Caddy), затем `X-Real-IP`.
   * По умолчанию `process.env.CLIENT_IP_HEADER`.
   */
  clientIpHeader?: string;
  /** Каталог собранной SPA (`STATIC_DIR`). Задан — API раздаёт её на `/`; нет — только API (dev: фронт отдаёт Vite). */
  staticDir?: string;
}

/** Типы контекста Hono: `c.var.db`, `c.var.now()`, `c.var.user` (после `requireAuth`). */
export interface AppEnv {
  Variables: {
    db: Db;
    now: () => Date;
    user: SessionUser;
  };
}
