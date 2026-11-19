import { randomBytes } from "node:crypto";
import {
  type Certificate,
  type CertificateVerification,
  REQUEST_CATEGORY,
  type RequestType,
} from "@aihs/contract";
import { and, eq } from "drizzle-orm";
import type { Db } from "../../db/client";
import { certificates, faculties, groups, requests, students } from "../../db/schema";
import { moscowDate } from "../../lib/moscow-time";

/** «Лебедянская Мирослава Игоревна» → «Л. М. И.». */
export function initialsOf(lastName: string, firstName: string, middleName: string | null): string {
  return [lastName, firstName, middleName]
    .filter((part): part is string => Boolean(part))
    .map((part) => `${Array.from(part)[0]?.toUpperCase()}.`)
    .join(" ");
}

const isCertificateType = (type: RequestType) => REQUEST_CATEGORY[type] === "certificate";

/**
 * Справка для печати по заявке студента. Выдаётся только для заявки-справки в статусе `ready`
 * своего студента; иначе `null` (роут отвечает 404 — не раскрываем, что заявка существует).
 * При первом вызове справке выдаётся случайный токен (32 байта, base64url) и номер; дальше они не меняются.
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
  if (!row || row.status !== "ready" || !isCertificateType(row.type)) return null;

  // Два одновременных первых открытия не создадут двух справок: вторая вставка просто ничего не сделает.
  await db
    .insert(certificates)
    .values({
      requestId,
      token: randomBytes(32).toString("base64url"),
      number: `AIHS-${moscowDate(row.issuedAt).slice(0, 4)}-${randomBytes(4).toString("hex").toUpperCase()}`,
      createdAt: now,
    })
    .onConflictDoNothing({ target: certificates.requestId });
  const [issued] = await db
    .select({ token: certificates.token, number: certificates.number })
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
