import type { Notification, NotificationType } from "@aihs/contract";
import {
  AlarmClock,
  BellOff,
  CalendarClock,
  CheckCheck,
  ChevronRight,
  FileText,
  type LucideIcon,
  Megaphone,
} from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { retryHint, useMarkRead, useNotifications } from "../../api";
import { cn } from "../../lib/cn";
import { Badge, Button, EmptyState, ErrorState, ListSkeleton, PageHeader } from "../../ui";
import { formatDueDate, formatTime, groupByDay, notificationTypeView, unreadLabel } from "./model";

const typeIcon: Record<NotificationType, LucideIcon> = {
  news: Megaphone,
  deadline: AlarmClock,
  schedule_change: CalendarClock,
  request: FileText,
};

type Filter = "all" | "unread" | "deadline";

function matchesFilter(item: Notification, filter: Filter): boolean {
  if (filter === "unread") return !item.read;
  if (filter === "deadline") return item.type === "deadline";
  return true;
}

/**
 * Лента: новости деканата, дедлайны, изменения расписания и статусы заявок, по дням.
 * Непрочитанные выделены точкой, жирным и подписью «Новое». Переход по уведомлению
 * отмечает его прочитанным; фильтр «Непрочитанные» живёт в адресе (`?filter=unread`).
 */
export function NotificationsPage() {
  const query = useNotifications();
  const [params, setParams] = useSearchParams();
  const selected = params.get("filter");
  const filter: Filter = selected === "unread" || selected === "deadline" ? selected : "all";
  const unread = query.data?.unreadCount ?? 0;

  return (
    <>
      <PageHeader
        title="Уведомления"
        description={query.data ? unreadLabel(unread) : undefined}
        actions={unread > 0 && query.data && <MarkAllRead items={query.data.items} />}
      />
      <div
        role="tablist"
        aria-label="Какие показать"
        className="mb-4 inline-flex max-w-full flex-wrap gap-1 rounded-lg bg-muted p-1"
      >
        {(
          [
            ["all", "Все"],
            ["unread", "Непрочитанные"],
            ["deadline", "Дедлайны"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`notifications-tab-${key}`}
            aria-selected={filter === key}
            aria-controls="notifications-panel"
            onClick={() => setParams(key === "all" ? {} : { filter: key }, { replace: true })}
            className={cn(
              "min-h-11 min-w-11 cursor-pointer rounded-md px-2 text-sm font-semibold transition-colors sm:px-4",
              filter === key
                ? "bg-surface text-foreground shadow-card"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div id="notifications-panel" role="tabpanel" aria-labelledby={`notifications-tab-${filter}`}>
        {query.isPending ? (
          <ListSkeleton rows={4} label="Загружаем уведомления…" />
        ) : query.isError ? (
          <ErrorState description={retryHint(query.error)} onRetry={() => query.refetch()} />
        ) : (
          <Feed
            items={query.data.items.filter((item) => matchesFilter(item, filter))}
            filter={filter}
          />
        )}
      </div>
    </>
  );
}

function MarkAllRead({ items }: { items: Notification[] }) {
  const markRead = useMarkRead();
  const [busy, setBusy] = useState(false);
  const markAll = async () => {
    setBusy(true);
    try {
      await Promise.all(items.filter((n) => !n.read).map((n) => markRead.mutateAsync(n.id)));
    } catch {
      // Что не отметилось, останется непрочитанным: лента обновится и покажет это.
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button variant="outline" size="sm" onClick={markAll} disabled={busy}>
      <CheckCheck aria-hidden />
      {busy ? "Отмечаем…" : "Прочитать все"}
    </Button>
  );
}

function Feed({ items, filter }: { items: Notification[]; filter: Filter }) {
  if (items.length === 0) {
    if (filter === "deadline") {
      return <EmptyState icon={AlarmClock} title="Дедлайнов пока нет" />;
    }
    return filter === "unread" ? (
      <EmptyState
        icon={CheckCheck}
        title="Всё прочитано"
        description="Новые уведомления появятся здесь."
      />
    ) : (
      <EmptyState
        icon={BellOff}
        title="Уведомлений пока нет"
        description="Сюда придут новости деканата, дедлайны и статусы заявок."
      />
    );
  }
  const now = new Date();
  return (
    <div className="flex flex-col gap-6">
      {groupByDay(items, now).map((group, i) => (
        <section key={group.title} aria-labelledby={`notifications-day-${i}`}>
          <h2
            id={`notifications-day-${i}`}
            className="mb-2 text-sm font-semibold text-muted-foreground"
          >
            {group.title}
          </h2>
          <ul className="flex flex-col gap-3">
            {group.items.map((item) => (
              <li key={item.id}>
                <NotificationCard item={item} now={now} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function NotificationCard({ item, now }: { item: Notification; now: Date }) {
  const markRead = useMarkRead();
  const { label, tone } = notificationTypeView(item.type);
  const Icon = typeIcon[item.type];
  const read = () => {
    if (!item.read) markRead.mutate(item.id);
  };

  const body = (
    <>
      <span
        aria-hidden
        className={cn(
          "mt-2 size-2 shrink-0 rounded-full",
          item.read ? "bg-transparent" : "bg-primary",
        )}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Badge tone={tone}>
            <Icon aria-hidden />
            {label}
          </Badge>
          {!item.read && <span className="text-xs font-semibold text-primary">Новое</span>}
          <time dateTime={item.createdAt} className="text-xs text-muted-foreground">
            {formatTime(item.createdAt, now)}
          </time>
        </div>
        <h3 className={cn("leading-snug", item.read ? "font-medium" : "font-semibold")}>
          {item.title}
        </h3>
        {item.type === "deadline" && item.dueDate && (
          <time dateTime={item.dueDate} className="text-sm font-semibold text-primary">
            до {formatDueDate(item.dueDate)}
          </time>
        )}
        {item.body && <p className="text-sm text-muted-foreground">{item.body}</p>}
      </div>
    </>
  );

  const frame = cn(
    "flex gap-3 rounded-lg border p-3 shadow-card sm:p-4",
    item.read ? "border-border bg-surface" : "border-primary-soft bg-primary-soft/40",
  );

  if (item.link) {
    return (
      <Link
        to={item.link}
        onClick={read}
        className={cn(frame, "items-start transition-colors hover:bg-muted")}
      >
        {body}
        <ChevronRight aria-hidden className="mt-1 size-5 shrink-0 text-muted-foreground" />
      </Link>
    );
  }
  return (
    <article className={cn(frame, "flex-col sm:flex-row")}>
      <div className="flex min-w-0 flex-1 gap-3">{body}</div>
      {!item.read && (
        <Button
          variant="ghost"
          size="sm"
          className="self-end sm:self-center"
          onClick={read}
          disabled={markRead.isPending}
        >
          Отметить прочитанным
        </Button>
      )}
    </article>
  );
}
