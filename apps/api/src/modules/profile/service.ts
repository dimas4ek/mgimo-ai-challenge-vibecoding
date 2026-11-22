import type { MyGroup, Profile } from "@aihs/contract";
import { asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
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

/** Группа определяется по студенту из сессии. В состав попадают только имена. */
export async function getMyGroup(db: Db, studentId: string): Promise<MyGroup | null> {
  const members = alias(schema.students, "group_members");
  const rows = await db
    .select({
      name: schema.groups.name,
      course: schema.groups.course,
      program: schema.groups.program,
      curator: schema.groups.curator,
      announcements: schema.groups.announcements,
      lastName: members.lastName,
      firstName: members.firstName,
      middleName: members.middleName,
    })
    .from(schema.students)
    .innerJoin(schema.groups, eq(schema.groups.id, schema.students.groupId))
    .innerJoin(members, eq(members.groupId, schema.groups.id))
    .where(eq(schema.students.id, studentId))
    .orderBy(asc(members.lastName), asc(members.firstName), asc(members.middleName));

  const group = rows[0];
  if (!group) return null;
  return {
    name: group.name,
    course: group.course,
    program: group.program,
    curator: group.curator,
    announcements: group.announcements,
    members: rows.map(({ lastName, firstName, middleName }) =>
      [lastName, firstName, middleName].filter(Boolean).join(" "),
    ),
  };
}
