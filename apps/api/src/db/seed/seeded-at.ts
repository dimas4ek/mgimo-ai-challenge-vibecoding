import { eq, sql } from "drizzle-orm";
import type { Db } from "../client";
import * as schema from "../schema";

/** Единственная строка таблицы `seed_meta`. */
const META_ID = 1;
/** Версия шаблонов расписания: старый сид обновляется при первом запуске новой версии. */
export const DEMO_SCHEDULE_VERSION = 2;

/** Сериализует засев, обновление недели и сброс, даже когда отметки засева ещё нет. */
export async function withSeedLock<T>(db: Db, write: (tx: Db) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`LOCK TABLE ${schema.seedMeta} IN SHARE ROW EXCLUSIVE MODE`);
    return write(tx);
  });
}

/**
 * Момент последнего засева или обновления демо-расписания.
 * От него сброс демо-данных строит заявки и уведомления, чтобы они совпадали с расписанием в базе.
 * Старая база без отметки — `null`.
 */
export async function getSeededAt(db: Db): Promise<Date | null> {
  return (await getSeedMetadata(db))?.seededAt ?? null;
}

export async function getSeedMetadata(db: Db) {
  const [row] = await db
    .select({
      seededAt: schema.seedMeta.seededAt,
      scheduleVersion: schema.seedMeta.scheduleVersion,
    })
    .from(schema.seedMeta)
    .where(eq(schema.seedMeta.id, META_ID));
  return row;
}

/** Записать момент построения и версию расписания внутри транзакции. */
export async function setSeededAt(db: Pick<Db, "insert">, at: Date): Promise<void> {
  const metadata = { seededAt: at, scheduleVersion: DEMO_SCHEDULE_VERSION };
  await db
    .insert(schema.seedMeta)
    .values({ id: META_ID, ...metadata })
    .onConflictDoUpdate({ target: schema.seedMeta.id, set: metadata });
}
