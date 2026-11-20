import { eq } from "drizzle-orm";
import type { Db } from "../client";
import * as schema from "../schema";
import { buildSeedData } from "./data";
import { seedAccounts } from "./index";
import { getSeededAt } from "./seeded-at";

/**
 * Сброс демо-данных одного студента к исходному сиду: его заявки (с историей) и уведомления его
 * пользователя удаляются и создаются заново из `buildSeedData` на момент засева (`seededAt`) —
 * так они совпадают с расписанием в базе, построенным тогда же. Старая база без отметки — от `now`.
 * Данные других студентов, расписание, оценки и сессии не трогаются. Студента нет → `false`.
 */
export async function resetStudentData(db: Db, studentId: string, now: Date): Promise<boolean> {
  const [student] = await db
    .select({ userId: schema.students.userId })
    .from(schema.students)
    .where(eq(schema.students.id, studentId));
  if (!student) return false;

  const data = buildSeedData((await getSeededAt(db)) ?? now, seedAccounts);
  const requests = data.requests.filter((r) => r.studentId === studentId);
  const requestIds = new Set(requests.map((r) => r.id));
  const history = data.requestHistory.filter((h) => requestIds.has(h.requestId));
  const notifications = data.notifications.filter((n) => n.userId === student.userId);

  await db.transaction(async (tx) => {
    // История заявок и выданные справки удаляются каскадом вместе с заявками.
    await tx.delete(schema.requests).where(eq(schema.requests.studentId, studentId));
    await tx.delete(schema.notifications).where(eq(schema.notifications.userId, student.userId));
    if (requests.length > 0) await tx.insert(schema.requests).values(requests);
    if (history.length > 0) await tx.insert(schema.requestHistory).values(history);
    if (notifications.length > 0) await tx.insert(schema.notifications).values(notifications);
  });
  return true;
}
