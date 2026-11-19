import type {
  ChangeStatusInput,
  CreateRequestInput,
  Request,
  RequestListItem,
  RequestStatus,
  StaffRequestItem,
  StaffRequestsQuery,
} from "@aihs/contract";
import { and, asc, desc, eq, inArray, notInArray } from "drizzle-orm";
import type { Db } from "../../db/client";
import * as schema from "../../db/schema";

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

/** Статусы, после которых заявка закрыта. */
const FINAL: readonly RequestStatus[] = ["ready", "rejected"];

type RequestRow = typeof schema.requests.$inferSelect;
type HistoryRow = typeof schema.requestHistory.$inferSelect;

const toItem = (r: RequestRow): RequestListItem => ({
  id: r.id,
  type: r.type,
  status: r.status,
  comment: r.comment,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

const toRequest = (r: RequestRow, history: HistoryRow[]): Request => ({
  ...toItem(r),
  history: history.map((h) => ({ status: h.status, at: h.at.toISOString(), comment: h.comment })),
});

/** История нескольких заявок одним запросом, по времени. */
async function historyOf(db: Db, ids: string[]): Promise<Map<string, HistoryRow[]>> {
  const map = new Map<string, HistoryRow[]>(ids.map((id) => [id, []]));
  if (ids.length === 0) return map;
  const rows = await db
    .select()
    .from(schema.requestHistory)
    .where(inArray(schema.requestHistory.requestId, ids))
    .orderBy(asc(schema.requestHistory.at), asc(schema.requestHistory.id));
  for (const h of rows) map.get(h.requestId)?.push(h);
  return map;
}

/**
 * Подать заявку от имени студента. Статус `submitted`, в истории одна запись `submitted`.
 * `studentId` — только из сессии (`c.var.user.studentId`), никогда из запроса.
 */
export async function createRequest(
  db: Db,
  studentId: string,
  input: CreateRequestInput,
  now: Date,
): Promise<Request> {
  const comment = input.comment?.trim() ? input.comment.trim() : null;
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(schema.requests)
      .values({
        studentId,
        type: input.type,
        status: "submitted",
        comment,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!row) throw new Error("createRequest: insert вернул пусто");
    const [h] = await tx
      .insert(schema.requestHistory)
      .values({ requestId: row.id, status: "submitted", comment: null, at: now })
      .returning();
    return toRequest(row, h ? [h] : []);
  });
}

/** Свои заявки студента, новые сверху. */
export async function listRequests(db: Db, studentId: string): Promise<RequestListItem[]> {
  const rows = await db
    .select()
    .from(schema.requests)
    .where(eq(schema.requests.studentId, studentId))
    .orderBy(desc(schema.requests.createdAt), desc(schema.requests.id));
  return rows.map(toItem);
}

/**
 * Карточка заявки с историей. Выборка `id = ? AND student_id = ?`: чужая или несуществующая — `null`
 * (роут отвечает 404, не раскрывая, что заявка существует).
 */
export async function getRequest(db: Db, studentId: string, id: string): Promise<Request | null> {
  const [row] = await db
    .select()
    .from(schema.requests)
    .where(and(eq(schema.requests.id, id), eq(schema.requests.studentId, studentId)));
  if (!row) return null;
  const history = await historyOf(db, [row.id]);
  return toRequest(row, history.get(row.id) ?? []);
}

/** Заявки с ФИО и группой студента (для кабинета сотрудника). */
async function withStudents(db: Db, rows: RequestRow[]): Promise<StaffRequestItem[]> {
  if (rows.length === 0) return [];
  const studentIds = [...new Set(rows.map((r) => r.studentId))];
  const people = await db
    .select({
      id: schema.students.id,
      lastName: schema.students.lastName,
      firstName: schema.students.firstName,
      middleName: schema.students.middleName,
      group: schema.groups.name,
    })
    .from(schema.students)
    .innerJoin(schema.groups, eq(schema.groups.id, schema.students.groupId))
    .where(inArray(schema.students.id, studentIds));
  const byId = new Map(people.map((p) => [p.id, p]));
  const history = await historyOf(
    db,
    rows.map((r) => r.id),
  );
  return rows.map((r) => {
    const p = byId.get(r.studentId);
    const fullName = p ? [p.lastName, p.firstName, p.middleName].filter(Boolean).join(" ") : "—";
    return {
      ...toRequest(r, history.get(r.id) ?? []),
      student: { fullName, group: p?.group ?? "—" },
    };
  });
}

/**
 * Очередь сотрудника (#10, `GET /api/staff/requests?status=`): заявки всех студентов с ФИО и группой,
 * новые сверху; `status` — фильтр. Вызывать только под `requireRole("staff")`.
 */
export async function listAllRequests(
  db: Db,
  query: StaffRequestsQuery,
): Promise<StaffRequestItem[]> {
  const rows = await db
    .select()
    .from(schema.requests)
    .where(query.status ? eq(schema.requests.status, query.status) : undefined)
    .orderBy(desc(schema.requests.createdAt), desc(schema.requests.id));
  return withStudents(db, rows);
}

/**
 * Сменить статус (вызывает кабинет сотрудника, #10). Пишет запись в историю и `updated_at`.
 * Уведомление студенту отправляет вызывающий через `notify` (#9) по `studentId` из результата.
 */
export async function changeRequestStatus(
  db: Db,
  id: string,
  input: ChangeStatusInput,
  now: Date,
): Promise<ChangeStatusResult> {
  const comment = input.comment?.trim() ? input.comment.trim() : null;
  const updated = await db.transaction(async (tx) => {
    // Условный UPDATE вместо «прочитать → проверить → записать»: два сотрудника одновременно
    // не смогут оба закрыть заявку — второй UPDATE не найдёт строку с незакрытым статусом.
    const [next] = await tx
      .update(schema.requests)
      .set({ status: input.status, updatedAt: now })
      .where(and(eq(schema.requests.id, id), notInArray(schema.requests.status, [...FINAL])))
      .returning();
    if (!next) {
      const [exists] = await tx
        .select({ id: schema.requests.id })
        .from(schema.requests)
        .where(eq(schema.requests.id, id));
      return { ok: false, reason: exists ? "final" : "not_found" } as const;
    }
    await tx
      .insert(schema.requestHistory)
      .values({ requestId: id, status: input.status, comment, at: now });
    return { ok: true, row: next } as const;
  });
  if (!updated.ok) return updated;
  const [item] = await withStudents(db, [updated.row]);
  if (!item) throw new Error("changeRequestStatus: заявка пропала после обновления");
  return { ok: true, item, studentId: updated.row.studentId };
}
