import type { Db } from "../client";

/**
 * Сброс демо-данных одного студента к исходному сиду на момент `now`: его заявки (с историей)
 * и уведомления его пользователя удаляются и создаются заново из `buildSeedData`. Данные других
 * студентов, расписание, оценки и сессии не трогаются. Студента нет → `false`.
 */
export async function resetStudentData(_db: Db, _studentId: string, _now: Date): Promise<boolean> {
  throw new Error("not implemented");
}
