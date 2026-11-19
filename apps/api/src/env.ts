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
}

/** Типы контекста Hono: `c.var.db`, `c.var.now()`, `c.var.user` (после `requireAuth`). */
export interface AppEnv {
  Variables: {
    db: Db;
    now: () => Date;
    user: SessionUser;
  };
}
