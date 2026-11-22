import type { Lesson, LessonChangeKind } from "@aihs/contract";
import {
  CalendarClock,
  CircleSlash,
  type LucideIcon,
  MapPin,
  Repeat,
  UserRound,
} from "lucide-react";
import { Link } from "react-router";
import { paths } from "../../app/paths";
import { cn } from "../../lib/cn";
import { Badge, type BadgeTone } from "../../ui";
import { formatDayTitle, lessonChangeLabel, lessonTypeLabel } from "./model";

type LessonCardProps = {
  lesson: Lesson;
  /** Пара идёт сейчас: карточка выделена и подписана «Идёт сейчас». */
  ongoing?: boolean;
  /** Показать дату (для «ближайшей пары» из другого дня). */
  showDate?: boolean;
};

const changeView: Record<LessonChangeKind, { icon: LucideIcon; tone: BadgeTone }> = {
  moved: { icon: CalendarClock, tone: "warning" },
  replaced: { icon: Repeat, tone: "info" },
  cancelled: { icon: CircleSlash, tone: "danger" },
};

/**
 * Карточка пары: время, предмет, тип, аудитория, преподаватель. Перенос, замена и отмена видны
 * бейджем с иконкой и текстом и пояснением деканата, а не только цветом. Отменённая пара зачёркнута.
 * Используется на экране расписания (#14) и на главной (#21).
 */
export function LessonCard({ lesson, ongoing = false, showDate = false }: LessonCardProps) {
  const change = lesson.change;
  const cancelled = change?.kind === "cancelled";
  const view = change ? changeView[change.kind] : null;
  return (
    <article
      className={cn(
        "flex gap-3 rounded-lg border bg-surface p-3 shadow-card sm:p-4",
        ongoing ? "border-primary ring-1 ring-primary" : "border-border",
        change && !ongoing && "border-l-4",
        change?.kind === "moved" && "border-l-warning",
        change?.kind === "replaced" && "border-l-info",
        cancelled && "border-l-danger",
      )}
    >
      <div className="flex w-14 shrink-0 flex-col text-sm tabular-nums">
        <time className={cn("font-semibold", cancelled && "line-through")}>{lesson.start}</time>
        <span className="text-muted-foreground">{lesson.end}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {(ongoing || view) && (
          <div className="flex flex-wrap gap-1.5">
            {ongoing && <Badge tone="primary">Идёт сейчас</Badge>}
            {change && view && (
              <Badge tone={view.tone}>
                <view.icon aria-hidden />
                {lessonChangeLabel[change.kind]}
              </Badge>
            )}
          </div>
        )}
        {showDate && <p className="text-xs text-muted-foreground">{formatDayTitle(lesson.date)}</p>}
        <h3
          className={cn(
            "font-semibold leading-snug",
            cancelled && "text-muted-foreground line-through",
          )}
        >
          {lesson.subjectId ? (
            <Link
              to={paths.curriculum({ subject: lesson.subjectId })}
              className="inline-flex min-h-11 items-center rounded-sm text-primary underline underline-offset-4"
            >
              {lesson.subject}
            </Link>
          ) : (
            lesson.subject
          )}
        </h3>
        <p className="text-sm text-muted-foreground">{lessonTypeLabel[lesson.type]}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-1.5">
            <MapPin aria-hidden className="size-4 text-muted-foreground" />
            <span className="sr-only">Аудитория </span>
            {lesson.room}
          </span>
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <UserRound aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            <span className="sr-only">Преподаватель </span>
            <span className="truncate">{lesson.teacher}</span>
          </span>
        </div>
        {change && <p className="text-sm text-muted-foreground">{change.note}</p>}
      </div>
    </article>
  );
}
