import { eq } from "drizzle-orm";
import type { Db } from "../client";
import * as schema from "../schema";

/** Единственная строка таблицы `seed_meta`. */
const META_ID = 1;

/**
 * Момент последнего засева демо-данных (`seed(db, { now })` сохраняет `seededAt = now`).
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

/** Записать момент засева (внутри транзакции сида). */
export async function setSeededAt(db: Pick<Db, "insert">, at: Date): Promise<void> {
  await db
    .insert(schema.seedMeta)
    .values({ id: META_ID, seededAt: at })
    .onConflictDoUpdate({ target: schema.seedMeta.id, set: { seededAt: at } });
}
