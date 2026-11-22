import { and, eq, inArray } from "drizzle-orm";
import { mondayOf, moscowDate } from "../../lib/moscow-time";
import type { Db } from "../client";
import * as schema from "../schema";
import { buildSeedData } from "./data";
import { seed, seedAccounts } from "./index";
import { DEMO_SCHEDULE_VERSION, getSeedMetadata, setSeededAt, withSeedLock } from "./seeded-at";

/** Раз в час проверяем, не началась ли новая неделя по Москве. */
export const REFRESH_INTERVAL_MS = 60 * 60 * 1000;

const weekOf = (at: Date) => mondayOf(moscowDate(at));

/**
 * Обновляет расписание и уведомления при смене недели по Москве или версии шаблонов.
 * Сохраняет заявки, их историю, выданные справки и уведомления по заявкам.
 * На пустой базе создаёт исходные демо-данные. Возвращает `true`, если данные обновились.
 */
export async function refreshWeeklySchedule(db: Db, now: Date): Promise<boolean> {
  return withSeedLock(db, async (tx) => {
    const metadata = await getSeedMetadata(tx);
    const currentWeek = weekOf(now);
    if (metadata) {
      const seededWeek = weekOf(metadata.seededAt);
      if (seededWeek > currentWeek) return false;
      if (seededWeek === currentWeek && metadata.scheduleVersion >= DEMO_SCHEDULE_VERSION) {
        return false;
      }
    }

    const data = buildSeedData(now, seedAccounts);
    const userIds = data.users.map((user) => user.id);
    if (!metadata) {
      // У старой базы может не быть отметки, хотя демо-аккаунты уже существуют.
      const [existing] = await tx
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(inArray(schema.users.id, userIds))
        .limit(1);
      if (!existing) {
        await seed(tx, { now });
        return true;
      }
    }

    // Изменения удаляются каскадом вместе с парами. Обновляем только учебные группы сида.
    await tx.delete(schema.lessons).where(
      inArray(
        schema.lessons.groupId,
        data.groups.map((group) => group.id),
      ),
    );
    await tx.insert(schema.lessons).values(data.lessons);
    await tx.insert(schema.lessonChanges).values(data.lessonChanges);

    await tx
      .delete(schema.notifications)
      .where(
        and(
          eq(schema.notifications.type, "schedule_change"),
          inArray(schema.notifications.userId, userIds),
        ),
      );
    await tx
      .insert(schema.notifications)
      .values(data.notifications.filter((notification) => notification.type === "schedule_change"));
    await setSeededAt(tx, now);
    return true;
  });
}

/** Недельная проверка для запуска API и фонового таймера. */
export { refreshWeeklySchedule as refreshDemoDataIfStale };

/**
 * Одна проверка без исключений наружу: ошибка обновления логируется, API работает на прежних данных.
 * `true`, если расписание обновилось.
 */
export async function refreshSafely(
  db: Db,
  now: Date,
  log: Pick<Console, "log" | "error"> = console,
): Promise<boolean> {
  try {
    const refreshed = await refreshWeeklySchedule(db, now);
    if (refreshed) log.log("Демо-расписание обновлено на текущую неделю (Europe/Moscow)");
    return refreshed;
  } catch (error) {
    log.error("Не удалось обновить демо-расписание", error);
    return false;
  }
}

/**
 * Проверять раз в `REFRESH_INTERVAL_MS` (первую проверку при старте `src/index.ts` делает сам).
 * Таймер `unref()` — не держит процесс при остановке. Возвращает функцию остановки.
 */
export function startDemoDataRefresh(db: Db, clock: () => Date = () => new Date()): () => void {
  const timer = setInterval(() => void refreshSafely(db, clock()), REFRESH_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}
