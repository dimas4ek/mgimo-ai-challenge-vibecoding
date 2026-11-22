import { mondayOf, moscowDate } from "../../lib/moscow-time";
import type { Db } from "../client";
import { seed } from "./index";
import { getSeededAt } from "./seeded-at";

/** Раз в час проверяем, не началась ли новая неделя по Москве. */
export const REFRESH_INTERVAL_MS = 60 * 60 * 1000;

const weekOf = (at: Date) => mondayOf(moscowDate(at));

/**
 * Обновляет расписание и уведомления об изменениях при смене недели по Москве.
 * Сохраняет заявки, их историю, выданные справки и уведомления по заявкам.
 * На пустой базе создаёт исходные демо-данные. Возвращает `true`, если данные обновились.
 */
export async function refreshWeeklySchedule(_db: Db, _now: Date): Promise<boolean> {
  throw new Error("not implemented");
}

/**
 * Пересев демо-данных при смене недели: если неделя по Москве (`mondayOf(moscowDate(now))`)
 * отличается от недели засева (`getSeededAt`) или базу ещё не засевали — полный `seed(db, { now })`.
 * Отметки засева нет (пустая или старая база до #35) — тоже пересев: неделю не знаем.
 * `true`, если был пересев. Вызывается при старте API и раз в час (`src/index.ts`), не в тестах.
 */
export async function refreshDemoDataIfStale(db: Db, now: Date): Promise<boolean> {
  const seededAt = await getSeededAt(db);
  if (seededAt && weekOf(seededAt) === weekOf(now)) return false;
  // seed() пишет всё в одной транзакции: читающие запросы видят либо старую неделю, либо новую.
  await seed(db, { now });
  return true;
}

/**
 * Одна проверка без исключений наружу: ошибка пересева логируется, API работает на прежних данных.
 * `true`, если был пересев.
 */
export async function refreshSafely(
  db: Db,
  now: Date,
  log: Pick<Console, "log" | "error"> = console,
): Promise<boolean> {
  try {
    const refreshed = await refreshDemoDataIfStale(db, now);
    if (refreshed) log.log("Демо-данные засеяны на текущую неделю (Europe/Moscow)");
    return refreshed;
  } catch (error) {
    log.error("Не удалось пересеять демо-данные, работаем на прежних:", error);
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
