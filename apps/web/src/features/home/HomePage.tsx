import type { Notification } from "@aihs/contract";
import {
  AlarmClock,
  CalendarDays,
  CalendarOff,
  ChevronRight,
  FilePlus,
  FileText,
  type LucideIcon,
  Megaphone,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import {
  retryHint,
  useMarkRead,
  useMe,
  useNotifications,
  useRequests,
  useSchedule,
} from "../../api";
import { paths } from "../../app/paths";
import { cn } from "../../lib/cn";
import { buttonVariants, ErrorState, ListSkeleton, PageHeader } from "../../ui";
import { formatDateTime, requestTypeLabel } from "../requests/model";
import { RequestStatusBadge } from "../requests/RequestStatusBadge";
import { LessonCard } from "../schedule/LessonCard";
import { addDays, formatDayTitle, isOngoing, moscowToday, nextLesson } from "../schedule/model";
import {
  firstName,
  greeting,
  homeAnnouncements,
  homeDeadlines,
  recentRequestUpdates,
} from "./model";

/** Блок главной: заголовок со ссылкой «Все» (переход в раздел в одно касание) и содержимое. */
function Block({
  id,
  title,
  icon: Icon,
  to,
  linkLabel,
  children,
}: {
  id: string;
  title: string;
  icon: LucideIcon;
  to: string;
  linkLabel: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id={id} className="flex items-center gap-2 text-lg font-semibold">
          <Icon aria-hidden className="size-5 text-primary" />
          {title}
        </h2>
        <Link
          to={to}
          aria-label={linkLabel}
          className="flex min-h-11 items-center gap-0.5 rounded-md px-2 text-sm font-semibold text-primary hover:bg-muted"
        >
          Все
          <ChevronRight aria-hidden className="size-4" />
        </Link>
      </div>
      {children}
    </section>
  );
}

/** Короткое пустое состояние блока: на главной большое не нужно. */
function Quiet({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
      <span>{children}</span>
      {action}
    </div>
  );
}

function NextLessonBlock({ now }: { now: Date }) {
  const week = useSchedule();
  const today = moscowToday(now);
  const lesson = week.data ? nextLesson(week.data.lessons, now) : null;
  return (
    <Block
      id="home-lesson"
      title="Следующая пара"
      icon={CalendarDays}
      to={paths.schedule}
      linkLabel="Всё расписание"
    >
      {week.isPending ? (
        <ListSkeleton rows={1} label="Загружаем расписание…" />
      ) : week.isError ? (
        <ErrorState description={retryHint(week.error)} onRetry={() => week.refetch()} />
      ) : lesson ? (
        <LessonCard
          lesson={lesson}
          ongoing={isOngoing(lesson, now)}
          showDate={lesson.date !== today}
        />
      ) : (
        <NextWeekLesson now={now} />
      )}
    </Block>
  );
}

/** На этой неделе пар больше нет — ищем первую на следующей. */
function NextWeekLesson({ now }: { now: Date }) {
  const week = useSchedule(addDays(moscowToday(now), 7));
  if (week.isPending) return <ListSkeleton rows={1} label="Загружаем расписание…" />;
  if (week.isError)
    return <ErrorState description={retryHint(week.error)} onRetry={() => week.refetch()} />;
  const lesson = nextLesson(week.data.lessons, now);
  if (!lesson) {
    return (
      <Quiet>
        <span className="inline-flex items-center gap-2">
          <CalendarOff aria-hidden className="size-4" />
          Ближайшие две недели пар нет.
        </span>
      </Quiet>
    );
  }
  return <LessonCard lesson={lesson} showDate />;
}

function NotificationRow({ n, now }: { n: Notification; now: Date }) {
  const markRead = useMarkRead();
  return (
    <li>
      <Link
        to={n.link ?? paths.notifications}
        onClick={() => {
          if (!n.read) markRead.mutate(n.id);
        }}
        className="flex min-h-11 items-start gap-3 rounded-lg border border-border bg-surface p-3 shadow-card hover:bg-muted"
      >
        <span
          aria-hidden
          className={cn(
            "mt-1.5 size-2 shrink-0 rounded-full",
            n.read ? "bg-transparent" : "bg-primary",
          )}
        />
        <span className="min-w-0 flex-1">
          <span className={cn("block text-sm", !n.read && "font-semibold")}>
            {!n.read && <span className="sr-only">Новое: </span>}
            {n.title}
          </span>
          <span className="mt-0.5 block text-sm text-muted-foreground line-clamp-2">{n.body}</span>
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatDateTime(n.createdAt, now)}
        </span>
      </Link>
    </li>
  );
}

function NotificationsBlock({ kind, now }: { kind: "deadlines" | "announcements"; now: Date }) {
  const query = useNotifications();
  const deadlines = kind === "deadlines";
  const items = query.data ? (deadlines ? homeDeadlines : homeAnnouncements)(query.data.items) : [];
  return (
    <Block
      id={`home-${kind}`}
      title={deadlines ? "Дедлайны" : "Объявления деканата"}
      icon={deadlines ? AlarmClock : Megaphone}
      to={paths.notifications}
      linkLabel="Все уведомления"
    >
      {query.isPending ? (
        <ListSkeleton rows={2} label="Загружаем уведомления…" />
      ) : query.isError ? (
        <ErrorState description={retryHint(query.error)} onRetry={() => query.refetch()} />
      ) : items.length === 0 ? (
        <Quiet>{deadlines ? "Ближайших дедлайнов нет." : "Новых объявлений нет."}</Quiet>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((n) => (
            <NotificationRow key={n.id} n={n} now={now} />
          ))}
        </ul>
      )}
    </Block>
  );
}

function RequestsBlock({ now }: { now: Date }) {
  const query = useRequests();
  const items = query.data ? recentRequestUpdates(query.data, now) : [];
  return (
    <Block
      id="home-requests"
      title="Заявки"
      icon={FileText}
      to={paths.requests}
      linkLabel="Все заявки"
    >
      {query.isPending ? (
        <ListSkeleton rows={1} label="Загружаем заявки…" />
      ) : query.isError ? (
        <ErrorState description={retryHint(query.error)} onRetry={() => query.refetch()} />
      ) : items.length === 0 ? (
        <Quiet
          action={
            <Link
              to={`${paths.requests}?new=1`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <FilePlus aria-hidden />
              Заказать справку
            </Link>
          }
        >
          За неделю статусы не менялись.
        </Quiet>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((r) => (
            <li key={r.id}>
              <Link
                to={paths.request(r.id)}
                className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface p-3 shadow-card hover:bg-muted"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{requestTypeLabel(r.type)}</span>
                  <span className="block text-xs text-muted-foreground">
                    Обновлено {formatDateTime(r.updatedAt, now)}
                  </span>
                </span>
                <RequestStatusBadge status={r.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Block>
  );
}

/**
 * Главная «Сегодня»: приветствие, следующая пара, дедлайны, заявки с новым статусом и объявления.
 * У каждого блока свои загрузка, пусто и ошибка; «Все» ведёт в раздел в одно касание.
 */
export function HomePage({ now = new Date() }: { now?: Date }) {
  const me = useMe();
  const hello = me.data
    ? `${greeting(now)}, ${firstName(me.data.displayName)}!`
    : `${greeting(now)}!`;
  return (
    <>
      <PageHeader title="Сегодня" description={`${hello} ${formatDayTitle(moscowToday(now))}.`} />
      <div className="grid gap-6 lg:grid-cols-2">
        <NextLessonBlock now={now} />
        <NotificationsBlock kind="deadlines" now={now} />
        <RequestsBlock now={now} />
        <NotificationsBlock kind="announcements" now={now} />
      </div>
    </>
  );
}
