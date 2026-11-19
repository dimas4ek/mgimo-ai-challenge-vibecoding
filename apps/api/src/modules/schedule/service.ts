import type { WeekSchedule } from "@aihs/contract";
import type { Db } from "../../db/client";

/**
 * Расписание группы студента на неделю (пн–вс), в которую попадает `week` (`YYYY-MM-DD`);
 * без `week` — текущая неделя по Москве относительно `now`. Пары по дате и времени,
 * с переносами, заменами и отменами (`change`). Студента нет → `null`.
 */
export async function getWeekSchedule(
  _db: Db,
  _studentId: string,
  _week: string | undefined,
  _now: Date,
): Promise<WeekSchedule | null> {
  throw new Error("not implemented");
}
