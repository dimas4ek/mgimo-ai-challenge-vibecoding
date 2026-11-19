import type { Profile } from "@aihs/contract";
import type { Db } from "../../db/client";

/** Профиль студента по id из сессии. Студента нет → `null` (→ 404). */
export async function getProfile(_db: Db, _studentId: string): Promise<Profile | null> {
  throw new Error("not implemented");
}
