import type { Certificate, CertificateVerification } from "@aihs/contract";
import type { Db } from "../../db/client";

/**
 * Справка для печати по заявке студента. Выдаётся только для заявки-справки в статусе `ready`
 * своего студента; иначе `null` (роут отвечает 404 — не раскрываем, что заявка существует).
 * При первом вызове справке выдаётся случайный токен (32 байта, base64url) и номер; дальше они не меняются.
 */
export async function getCertificate(
  _db: Db,
  _studentId: string,
  _requestId: string,
  _now: Date,
): Promise<Certificate | null> {
  throw new Error("not implemented");
}

/**
 * Публичная проверка по токену из QR. Отдаёт только минимум: тип, номер, дату, «действительна»
 * и инициалы. Неизвестный токен → `null` (роут отвечает 404).
 */
export async function verifyCertificate(
  _db: Db,
  _token: string,
): Promise<CertificateVerification | null> {
  throw new Error("not implemented");
}
