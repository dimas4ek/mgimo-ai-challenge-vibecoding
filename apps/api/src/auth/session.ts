import type { Db } from "../db/client";
import type { SessionUser } from "../env";

/** Имя cookie сессии. */
export const SESSION_COOKIE = "aihs_session";

/** Срок жизни сессии. */
export const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Проверяет логин и пароль (argon2id). `null` — неверный логин или пароль, без уточнения, что именно.
 */
export async function verifyCredentials(
  db: Db,
  login: string,
  password: string,
): Promise<SessionUser | null> {
  void db;
  void login;
  void password;
  throw new Error("not implemented");
}

/** Создаёт сессию и возвращает случайный токен для cookie. В БД хранится только SHA-256 токена. */
export async function createSession(db: Db, userId: string, now: Date): Promise<string> {
  void db;
  void userId;
  void now;
  throw new Error("not implemented");
}

/** Пользователь по токену из cookie. Просроченная или неизвестная сессия → `null`. */
export async function findSessionUser(
  db: Db,
  token: string,
  now: Date,
): Promise<SessionUser | null> {
  void db;
  void token;
  void now;
  throw new Error("not implemented");
}

/** Удаляет сессию на сервере (logout). Неизвестный токен — не ошибка. */
export async function deleteSession(db: Db, token: string): Promise<void> {
  void db;
  void token;
  throw new Error("not implemented");
}
