import type { RequestStatusChange } from "@aihs/contract";
import type { ReactNode } from "react";

type RequestTimelineProps = {
  history: readonly RequestStatusChange[];
  now: Date;
  /** Подпись перед комментарием: «Деканат» у студента, «Комментарий» у сотрудника. */
  commentLabel?: string;
};

/**
 * История статусов заявки сверху вниз (`timeline`): бейдж статуса, время по Москве, комментарий.
 * Общая для карточки студента (#16) и кабинета сотрудника (#18).
 */
export function RequestTimeline(_props: RequestTimelineProps): ReactNode {
  throw new Error("not implemented");
}
