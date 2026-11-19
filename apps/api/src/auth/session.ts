import { createHash, randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { and, eq, gt } from "drizzle-orm";
import type { Db } from "../db/client";
import { sessions, students, users } from "../db/schema";
import type { SessionUser } from "../env";

/** Имя cookie сессии. */
export const SESSION_COOKIE = "aihs_session";

/** Срок жизни сессии. */
export const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

// Для несуществующего логина всё равно считаем argon2: время ответа не выдаёт, есть ли такой логин.
let dummyHash: Promise<string> | undefined;

const sessionUserColumns = {
  id: users.id,
  role: users.role,
  displayName: users.displayName,
  studentId: students.id,
};

/**
 * Проверяет логин и пароль (argon2id). `null` — неверный логин или пароль, без уточнения, что именно.
 */
export async function verifyCredentials(
  db: Db,
  login: string,
  password: string,
): Promise<SessionUser | null> {
  const [row] = await db
    .select({ ...sessionUserColumns, passwordHash: users.passwordHash })
    .from(users)
    .leftJoin(students, eq(students.userId, users.id))
    .where(eq(users.login, login));
  if (!row) {
    dummyHash ??= hash("aihs-no-such-user");
    await verify(await dummyHash, password);
    return null;
  }
  if (!(await verify(row.passwordHash, password))) return null;
  const { passwordHash: _passwordHash, ...user } = row;
  return user;
}

/** Создаёт сессию и возвращает случайный токен для cookie. В БД хранится только SHA-256 токена. */
export async function createSession(db: Db, userId: string, now: Date): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.insert(sessions).values({
    tokenHash: hashToken(token),
    userId,
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    createdAt: now,
  });
  return token;
}

/** Пользователь по токену из cookie. Просроченная или неизвестная сессия → `null`. */
export async function findSessionUser(
  db: Db,
  token: string,
  now: Date,
): Promise<SessionUser | null> {
  const [row] = await db
    .select(sessionUserColumns)
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .leftJoin(students, eq(students.userId, users.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, now)));
  return row ?? null;
}

/** Удаляет сессию на сервере (logout). Неизвестный токен — не ошибка. */
export async function deleteSession(db: Db, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}
