import { hash } from "@node-rs/argon2";
import { and, eq, inArray, isNull, notInArray } from "drizzle-orm";
import type { Db } from "../client";
import * as schema from "../schema";
import { buildCurriculum, buildSeedData, demoGroupDetails, previousSemester, seedId } from "./data";
import { seedDiscussions } from "./discussions";
import { setSeededAt, withSeedLock } from "./seeded-at";

/**
 * Тестовые аккаунты вымышленного вуза. Пароли тоже вымышленные, они же будут в README для жюри.
 * Логины не меняем: на них опираются тесты и e2e.
 */
export const seedAccounts = {
  /** Мирослава Лебедянская, ПИИ-301. */
  student: { login: "student", password: "aihs-student-2026" },
  /** Тихон Колосовский, другая группа и другие данные. */
  student2: { login: "student2", password: "aihs-student2-2026" },
  /** Вероника Сташевская, сотрудник деканата. */
  staff: { login: "staff", password: "aihs-staff-2026" },
} as const;

export interface SeedOptions {
  /** «Сейчас»: от него считаются текущая неделя (Europe/Moscow), пары, даты заявок и уведомлений. */
  now: Date;
}

/**
 * Заполняет БД демо-данными AI High School. Идемпотентен: повторный запуск с тем же `now`
 * даёт то же состояние (id детерминированные). Заявки и уведомления, созданные руками, стираются —
 * этим же пользуется сброс демо-данных. Пароли пользователей при повторе не перехешируются,
 * поэтому открытые сессии переживают сид.
 *
 * Пары строятся на несколько недель вокруг `now`: есть субботние пары, переносы, замены и отмены,
 * у двух студентов разные группы и разные данные.
 */
export async function seed(db: Db, options: SeedOptions): Promise<void> {
  const data = buildSeedData(options.now, seedAccounts);
  const userIds = data.users.map((u) => u.id);

  await withSeedLock(db, async (tx) => {
    // argon2 медленный нарочно: хешируем только тех, кого ещё нет в БД.
    const existing = await tx
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(inArray(schema.users.id, userIds));
    const existingIds = new Set(existing.map((r) => r.id));
    const newUsers = await Promise.all(
      data.users
        .filter((u) => !existingIds.has(u.id))
        .map(async ({ password, ...u }) => ({ ...u, passwordHash: await hash(password) })),
    );

    // Чужие пользователи (их в демо быть не должно) уходят вместе с сессиями и уведомлениями.
    await tx.delete(schema.users).where(notInArray(schema.users.id, userIds));
    for (const { password: _password, id, ...u } of data.users) {
      if (existingIds.has(id)) {
        await tx
          .update(schema.users)
          .set({ login: u.login, role: u.role, displayName: u.displayName })
          .where(inArray(schema.users.id, [id]));
      }
    }
    if (newUsers.length > 0) await tx.insert(schema.users).values(newUsers);

    // Остальное пересоздаётся целиком; порядок удаления учитывает внешние ключи.
    await tx.delete(schema.notifications);
    await tx.delete(schema.requests);
    await tx.delete(schema.grades);
    await tx.delete(schema.lessons);
    await tx.delete(schema.students);
    await tx.delete(schema.groups);
    await tx.delete(schema.faculties);
    await tx.delete(schema.teachers);
    await tx.delete(schema.subjects);
    await tx.delete(schema.semesters);

    await tx.insert(schema.faculties).values(data.faculties);
    await tx.insert(schema.groups).values(data.groups);
    await tx.insert(schema.students).values(data.students);
    await tx.insert(schema.teachers).values(data.teachers);
    await tx.insert(schema.subjects).values(data.subjects);
    await tx.insert(schema.lessons).values(data.lessons);
    await tx.insert(schema.lessonChanges).values(data.lessonChanges);
    await tx.insert(schema.semesters).values(data.semesters);
    await tx.insert(schema.grades).values(data.grades);
    await seedCurriculum(tx);
    await tx.insert(schema.requests).values(data.requests);
    await tx.insert(schema.requestHistory).values(data.requestHistory);
    await tx.insert(schema.notifications).values(data.notifications);
    await seedDiscussions(tx, options.now);
    // От этого момента построено расписание: сброс демо-данных строит заявки и уведомления от него же.
    await setSeededAt(tx, options.now);
  });
}

/** Заполняет план и в уже работающей демобазе, сохраняя заявки и личные оценки. */
export async function seedCurriculum(db: Db): Promise<void> {
  const [current] = await db
    .select()
    .from(schema.semesters)
    .where(eq(schema.semesters.isCurrent, true));
  if (!current) return;
  const pastId = previousSemester(current).id;
  const [past] = pastId
    ? await db
        .select({ id: schema.semesters.id })
        .from(schema.semesters)
        .where(eq(schema.semesters.id, pastId))
    : [];
  await db
    .insert(schema.curriculum)
    .values(buildCurriculum(current.id, past?.id))
    .onConflictDoNothing();
}

/** Дополняет существующую демобазу без пересоздания пользователей и заявок. */
export async function seedGroupDetails(db: Db): Promise<void> {
  for (const [key, details] of Object.entries(demoGroupDetails)) {
    await db
      .update(schema.groups)
      .set(details)
      .where(and(eq(schema.groups.id, seedId(`group:${key}`)), isNull(schema.groups.curator)));
  }
}
