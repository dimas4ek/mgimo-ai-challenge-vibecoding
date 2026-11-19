import type { ChangeStatusInput, RequestType } from "@aihs/contract";
import type { Db } from "../../db/client";
import { type NotifyPayload, notify } from "../notifications/service";
import { type ChangeStatusResult, changeRequestStatus } from "../requests/service";

/** Как тип заявки звучит в уведомлении. */
const TYPE_LABEL = {
  enrollment_certificate: "Справка об обучении",
  scholarship_certificate: "Справка о стипендии",
  military_registration_certificate: "Справка для военкомата",
  transcript: "Выписка оценок",
  retake_application: "Заявление на пересдачу",
  academic_leave_application: "Заявление на академический отпуск",
  individual_schedule_application: "Заявление на индивидуальный график",
} as const satisfies Record<RequestType, string>;

type TargetStatus = ChangeStatusInput["status"];

/** Окончание заголовка и текст по умолчанию (если деканат не оставил комментарий). */
const STATUS_TEXT = {
  in_review: { title: "на рассмотрении", body: "Деканат начал рассматривать вашу заявку." },
  ready: { title: "готова", body: "Заявка выполнена. Подробности в карточке заявки." },
  rejected: { title: "отклонена", body: "Деканат отклонил заявку. Подробности в карточке заявки." },
} as const satisfies Record<TargetStatus, { title: string; body: string }>;

/** Текст уведомления о смене статуса: ведёт в карточку заявки, комментарий деканата — в тело. */
export function statusNotification(
  request: { id: string; type: RequestType },
  status: TargetStatus,
  comment: string | null,
): NotifyPayload {
  const text = STATUS_TEXT[status];
  return {
    type: "request",
    title: `${TYPE_LABEL[request.type]}: ${text.title}`,
    body: comment ?? text.body,
    link: `/requests/${request.id}`,
  };
}

/**
 * Смена статуса заявки сотрудником (#10): `changeRequestStatus` (статус + история), затем
 * уведомление студенту. Роут вызывает только эту функцию, поэтому уведомление не забыть.
 */
export async function changeStatusAndNotify(
  db: Db,
  id: string,
  input: ChangeStatusInput,
  now: Date,
): Promise<ChangeStatusResult> {
  const result = await changeRequestStatus(db, id, input, now);
  if (!result.ok) return result;
  const comment = input.comment?.trim() ? input.comment.trim() : null;
  await notify(db, result.studentId, statusNotification(result.item, input.status, comment), now);
  return result;
}
