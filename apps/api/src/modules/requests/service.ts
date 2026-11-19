import type {
  ChangeStatusInput,
  CreateRequestInput,
  Request,
  RequestListItem,
  StaffRequestItem,
  StaffRequestsQuery,
} from "@aihs/contract";
import type { Db } from "../../db/client";

/**
 * Итог смены статуса сотрудником.
 * - `ok` — статус сменён, в истории новая запись; `item` — готовый ответ роута #10
 *   (`StaffRequestItem` с ФИО и группой), `studentId` — для `notify` (#9);
 * - `not_found` — заявки нет;
 * - `final` — заявка уже `ready`/`rejected`, менять нельзя (роут отвечает 409).
 */
export type ChangeStatusResult =
  | { ok: true; item: StaffRequestItem; studentId: string }
  | { ok: false; reason: "not_found" | "final" };

/**
 * Подать заявку от имени студента. Статус `submitted`, в истории одна запись `submitted`.
 * `studentId` — только из сессии (`c.var.user.studentId`), никогда из запроса.
 */
export async function createRequest(
  _db: Db,
  _studentId: string,
  _input: CreateRequestInput,
  _now: Date,
): Promise<Request> {
  throw new Error("not implemented");
}

/** Свои заявки студента, новые сверху. */
export async function listRequests(_db: Db, _studentId: string): Promise<RequestListItem[]> {
  throw new Error("not implemented");
}

/**
 * Карточка заявки с историей. Выборка `id = ? AND student_id = ?`: чужая или несуществующая — `null`
 * (роут отвечает 404, не раскрывая, что заявка существует).
 */
export async function getRequest(
  _db: Db,
  _studentId: string,
  _id: string,
): Promise<Request | null> {
  throw new Error("not implemented");
}

/**
 * Очередь сотрудника (#10, `GET /api/staff/requests?status=`): заявки всех студентов с ФИО и группой,
 * новые сверху; `status` — фильтр. Вызывать только под `requireRole("staff")`.
 */
export async function listAllRequests(
  _db: Db,
  _query: StaffRequestsQuery,
): Promise<StaffRequestItem[]> {
  throw new Error("not implemented");
}

/**
 * Сменить статус (вызывает кабинет сотрудника, #10). Пишет запись в историю и `updated_at`.
 * Уведомление студенту отправляет вызывающий через `notify` (#9) по `studentId` из результата.
 */
export async function changeRequestStatus(
  _db: Db,
  _id: string,
  _input: ChangeStatusInput,
  _now: Date,
): Promise<ChangeStatusResult> {
  throw new Error("not implemented");
}
