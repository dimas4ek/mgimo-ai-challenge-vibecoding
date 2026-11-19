import type { Profile } from "@aihs/contract";
import { eq } from "drizzle-orm";
import type { Db } from "../../db/client";
import * as schema from "../../db/schema";

/** Профиль студента по id из сессии. Студента нет → `null` (→ 404). */
export async function getProfile(db: Db, studentId: string): Promise<Profile | null> {
  const [row] = await db
    .select({
      lastName: schema.students.lastName,
      firstName: schema.students.firstName,
      middleName: schema.students.middleName,
      recordBookNumber: schema.students.recordBookNumber,
      email: schema.students.email,
      group: schema.groups.name,
      program: schema.groups.program,
      course: schema.groups.course,
      faculty: schema.faculties.name,
    })
    .from(schema.students)
    .innerJoin(schema.groups, eq(schema.groups.id, schema.students.groupId))
    .innerJoin(schema.faculties, eq(schema.faculties.id, schema.groups.facultyId))
    .where(eq(schema.students.id, studentId));
  return row ?? null;
}
