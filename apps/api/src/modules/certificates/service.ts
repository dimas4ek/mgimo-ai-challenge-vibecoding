import { randomBytes } from "node:crypto";
import {
  type Certificate,
  type CertificateGrade,
  type CertificateVerification,
  REQUEST_CATEGORY,
  type RequestType,
} from "@aihs/contract";
import { and, asc, eq } from "drizzle-orm";
import type { Db } from "../../db/client";
import {
  certificates,
  faculties,
  grades,
  groups,
  requests,
  semesters,
  students,
  subjects,
} from "../../db/schema";
import { moscowDate } from "../../lib/moscow-time";
import { semesterOrder } from "../../lib/semester-order";

/** «Лебедянская Мирослава Игоревна» → «Л. М. И.». */
export function initialsOf(lastName: string, firstName: string, middleName: string | null): string {
  return [lastName, firstName, middleName]
    .filter((part): part is string => Boolean(part))
    .map((part) => `${Array.from(part)[0]?.toUpperCase()}.`)
    .join(" ");
}

const isCertificateType = (type: RequestType) => REQUEST_CATEGORY[type] === "certificate";

/**
 * Снимок оценок студента для выписки: все семестры из БД, по порядку семестров и дисциплин.
 * Вызывается, когда выписка выдаётся (заявка становится `ready`), и сохраняется вместе со справкой.
 */
export async function snapshotGrades(db: Db, studentId: string): Promise<CertificateGrade[]> {
  const rows = await db
    .select({
      semester: semesters.name,
      subject: subjects.name,
      controlForm: grades.controlForm,
      credits: grades.credits,
      semesterPoints: grades.semesterPoints,
      examPoints: grades.examPoints,
      result: grades.result,
    })
    .from(grades)
    .innerJoin(semesters, eq(semesters.id, grades.semesterId))
    .innerJoin(subjects, eq(subjects.id, grades.subjectId))
    .where(eq(grades.studentId, studentId))
    .orderBy(asc(subjects.name), asc(grades.id));
  return rows
    .map(({ semesterPoints, examPoints, ...r }) => ({
      ...r,
      totalPoints: semesterPoints + (examPoints ?? 0),
    }))
    .sort((a, b) => semesterOrder(a.semester) - semesterOrder(b.semester));
}

/**
 * Выдаёт справку по готовой заявке: случайный токен (32 байта, base64url), номер и, для выписки,
 * снимок оценок. Справка уже есть → ничего не делает, поэтому токен, номер и оценки не меняются.
 * Вызывается при переходе заявки в `ready` и, для заявок, готовых ещё в сиде, при первом открытии.
 */
export async function issueCertificate(
  db: Db,
  request: { id: string; studentId: string; type: RequestType },
  issuedAt: Date,
  now: Date,
): Promise<void> {
  if (!isCertificateType(request.type)) return;
  const [existing] = await db
    .select({ requestId: certificates.requestId })
    .from(certificates)
    .where(eq(certificates.requestId, request.id));
  if (existing) return;
  // Два одновременных первых открытия не создадут двух справок: вторая вставка просто ничего не сделает.
  await db
    .insert(certificates)
    .values({
      requestId: request.id,
      token: randomBytes(32).toString("base64url"),
      number: `AIHS-${moscowDate(issuedAt).slice(0, 4)}-${randomBytes(4).toString("hex").toUpperCase()}`,
      grades: request.type === "transcript" ? await snapshotGrades(db, request.studentId) : null,
      createdAt: now,
    })
    .onConflictDoNothing({ target: certificates.requestId });
}

/**
 * Справка для печати по заявке студента. Выдаётся только для заявки-справки в статусе `ready`
 * своего студента; иначе `null` (роут отвечает 404 — не раскрываем, что заявка существует).
 * Справка выдаётся при переходе заявки в `ready` (`issueCertificate`); у заявок, готовых ещё в сиде, —
 * при первом открытии. Токен, номер и оценки выписки дальше не меняются.
 */
export async function getCertificate(
  db: Db,
  studentId: string,
  requestId: string,
  now: Date,
): Promise<Certificate | null> {
  const [row] = await db
    .select({
      type: requests.type,
      status: requests.status,
      comment: requests.comment,
      // Готовая заявка дальше не меняется, поэтому момент последнего изменения и есть момент выдачи.
      issuedAt: requests.updatedAt,
      lastName: students.lastName,
      firstName: students.firstName,
      middleName: students.middleName,
      recordBookNumber: students.recordBookNumber,
      group: groups.name,
      program: groups.program,
      course: groups.course,
      faculty: faculties.name,
    })
    .from(requests)
    .innerJoin(students, eq(students.id, requests.studentId))
    .innerJoin(groups, eq(groups.id, students.groupId))
    .innerJoin(faculties, eq(faculties.id, groups.facultyId))
    .where(and(eq(requests.id, requestId), eq(requests.studentId, studentId)));
  if (row?.status !== "ready" || !isCertificateType(row.type)) return null;

  await issueCertificate(db, { id: requestId, studentId, type: row.type }, row.issuedAt, now);
  const [issued] = await db
    .select({ token: certificates.token, number: certificates.number, grades: certificates.grades })
    .from(certificates)
    .where(eq(certificates.requestId, requestId));
  if (!issued) throw new Error(`справка для заявки ${requestId} не сохранилась`);

  return {
    requestId,
    type: row.type,
    number: issued.number,
    issuedAt: row.issuedAt.toISOString(),
    token: issued.token,
    verifyPath: `/verify/${issued.token}`,
    student: {
      fullName: [row.lastName, row.firstName, row.middleName].filter(Boolean).join(" "),
      recordBookNumber: row.recordBookNumber,
      faculty: row.faculty,
      program: row.program,
      course: row.course,
      group: row.group,
    },
    purpose: row.comment,
    grades: issued.grades ?? (row.type === "transcript" ? [] : null),
  };
}

/**
 * Публичная проверка по токену из QR. Отдаёт только минимум: тип, номер, дату, «действительна»
 * и инициалы. Неизвестный токен → `null` (роут отвечает 404).
 */
export async function verifyCertificate(
  db: Db,
  token: string,
): Promise<CertificateVerification | null> {
  const [row] = await db
    .select({
      type: requests.type,
      status: requests.status,
      issuedAt: requests.updatedAt,
      number: certificates.number,
      lastName: students.lastName,
      firstName: students.firstName,
      middleName: students.middleName,
    })
    .from(certificates)
    .innerJoin(requests, eq(requests.id, certificates.requestId))
    .innerJoin(students, eq(students.id, requests.studentId))
    .where(eq(certificates.token, token));
  if (!row) return null;
  return {
    type: row.type,
    number: row.number,
    issuedOn: moscowDate(row.issuedAt),
    valid: row.status === "ready",
    holderInitials: initialsOf(row.lastName, row.firstName, row.middleName),
  };
}
