import type { Db } from "../client";

/**
 * Пересев демо-данных при смене недели: если неделя по Москве (`mondayOf(moscowDate(now))`)
 * отличается от недели засева (`getSeededAt`) или базу ещё не засевали — полный `seed(db, { now })`.
 * `true`, если был пересев. Вызывается при старте API и раз в час (`src/index.ts`), не в тестах.
 */
export async function refreshDemoDataIfStale(_db: Db, _now: Date): Promise<boolean> {
  throw new Error("not implemented");
}
