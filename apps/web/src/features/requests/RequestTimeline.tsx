import type { RequestStatusChange } from "@aihs/contract";
import { cn } from "../../lib/cn";
import { formatDateTime, requestStatusView, timeline } from "./model";
import { RequestStatusBadge } from "./RequestStatusBadge";

type RequestTimelineProps = {
  history: readonly RequestStatusChange[];
  now: Date;
  /** Подпись перед комментарием: «Деканат» у студента, «Комментарий» у сотрудника. */
  commentLabel?: string;
};

const dotTone = {
  neutral: "bg-muted-foreground",
  info: "bg-info",
  success: "bg-success",
  danger: "bg-danger",
} as const;

/**
 * История статусов заявки сверху вниз (`timeline`): бейдж статуса, время по Москве, комментарий.
 * Общая для карточки студента (#16) и кабинета сотрудника (#18).
 */
export function RequestTimeline({ history, now, commentLabel = "Деканат" }: RequestTimelineProps) {
  const entries = timeline(history);
  return (
    <ol className="flex flex-col">
      {entries.map((entry, i) => {
        const last = i === entries.length - 1;
        const { tone } = requestStatusView(entry.status);
        return (
          <li key={`${entry.status}-${entry.at}`} className="relative flex gap-3 pb-5 last:pb-0">
            {!last && (
              <span
                aria-hidden
                className="absolute top-6 bottom-0 left-2 w-0.5 -translate-x-1/2 bg-border"
              />
            )}
            <span
              aria-hidden
              className={cn(
                "mt-1 size-4 shrink-0 rounded-full",
                dotTone[tone as keyof typeof dotTone] ?? dotTone.neutral,
                last && "ring-4 ring-primary-soft",
              )}
            />
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <RequestStatusBadge status={entry.status} />
                <time dateTime={entry.at} className="text-xs text-muted-foreground">
                  {formatDateTime(entry.at, now)}
                </time>
              </div>
              {entry.comment && (
                <p className="text-sm break-words">
                  <span className="text-muted-foreground">{commentLabel}: </span>
                  {entry.comment}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
