import { eq, sql } from "drizzle-orm";
import type { Db } from "../client";
import * as schema from "../schema";

/** Единственная строка таблицы `seed_meta`. */
const META_ID = 1;

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
  const [row] = await db
    .select({ seededAt: schema.seedMeta.seededAt })
    .from(schema.seedMeta)
    .where(eq(schema.seedMeta.id, META_ID));
  return row?.seededAt ?? null;
}

/** Записать момент построения расписания внутри транзакции. */
export async function setSeededAt(db: Pick<Db, "insert">, at: Date): Promise<void> {
  await db
    .insert(schema.seedMeta)
    .values({ id: META_ID, seededAt: at })
    .onConflictDoUpdate({ target: schema.seedMeta.id, set: { seededAt: at } });
}
