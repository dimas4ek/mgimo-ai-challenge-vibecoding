import type { StaffRequestItem } from "@aihs/contract";
import { ArrowLeft, ChevronRight, CircleCheck, Inbox, SearchX } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { retryHint, useChangeRequestStatus, useStaffRequests } from "../../api";
import { paths } from "../../app/paths";
import { cn } from "../../lib/cn";
import {
  Button,
  buttonVariants,
  Card,
  CardTitle,
  EmptyState,
  ErrorState,
  Field,
  ListSkeleton,
  PageHeader,
  Textarea,
} from "../../ui";
import { formatDateTime, requestStatusView, requestTypeLabel } from "../requests/model";
import { RequestStatusBadge } from "../requests/RequestStatusBadge";
import { RequestTimeline } from "../requests/RequestTimeline";
import {
  nextStatuses,
  parseStaffFilter,
  type StaffFilter,
  sortQueue,
  staffFilterOptions,
  statusActionLabel,
  type TargetStatus,
  validateStaffComment,
} from "./model";

/** Адрес очереди: фильтр и открытая заявка (`/staff?status=in_review&id=…`). */
const staffHref = (filter: StaffFilter, id?: string) => {
  const params = new URLSearchParams();
  if (filter !== "submitted") params.set("status", filter);
  if (id) params.set("id", id);
  const query = params.toString();
  return query ? `${paths.staff}?${query}` : paths.staff;
};

/**
 * Кабинет сотрудника деканата: очередь заявок с фильтром по статусу, карточка и смена статуса
 * с комментарием. Фильтр и открытая заявка — в адресе. На телефоне карточка открывается вместо
 * списка, на широком экране — рядом.
 */
export function StaffPage() {
  const [params] = useSearchParams();
  const filter = parseStaffFilter(params.get("status"));
  const selectedId = params.get("id");

  return (
    <>
      <PageHeader
        title="Заявки студентов"
        description="Новые и в работе — по очереди: кто раньше подал, тот выше."
      />
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start lg:gap-6">
        <div className={cn("flex flex-col gap-4", selectedId && "hidden lg:flex")}>
          <nav aria-label="Статус заявок" className="flex flex-wrap gap-2">
            {staffFilterOptions().map((option) => (
              <Link
                key={option.value}
                to={staffHref(option.value)}
                replace
                aria-current={filter === option.value ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors",
                  filter === option.value
                    ? "border-primary bg-primary-soft text-primary-soft-foreground"
                    : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {option.label}
              </Link>
            ))}
          </nav>
          <Queue filter={filter} selectedId={selectedId} />
        </div>
        {selectedId ? (
          <RequestPanel id={selectedId} filter={filter} />
        ) : (
          <p className="hidden rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground lg:block">
            Выберите заявку слева, чтобы посмотреть детали и сменить статус.
          </p>
        )}
      </div>
    </>
  );
}

function Queue({ filter, selectedId }: { filter: StaffFilter; selectedId: string | null }) {
  const query = useStaffRequests(filter === "all" ? undefined : { status: filter });
  if (query.isPending) return <ListSkeleton rows={4} label="Загружаем заявки…" />;
  if (query.isError)
    return <ErrorState description={retryHint(query.error)} onRetry={() => query.refetch()} />;
  if (query.data.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title={filter === "submitted" ? "Новых заявок нет" : "Здесь пусто"}
        description={
          filter === "submitted"
            ? "Всё разобрано. Загляните в «В работе»."
            : "Заявок с таким статусом пока нет."
        }
      />
    );
  }
  const now = new Date();
  return (
    <ul className="flex flex-col gap-3">
      {sortQueue(query.data).map((item) => (
        <li key={item.id}>
          <Link
            to={staffHref(filter, item.id)}
            aria-current={item.id === selectedId ? "true" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg border bg-surface p-3 shadow-card transition-colors hover:bg-muted sm:p-4",
              item.id === selectedId ? "border-primary ring-1 ring-primary" : "border-border",
            )}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold leading-snug">{requestTypeLabel(item.type)}</span>
                <RequestStatusBadge status={item.status} />
              </div>
              <p className="text-sm break-words">
                {item.student.fullName}
                <span className="text-muted-foreground"> · {item.student.group}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Подана {formatDateTime(item.createdAt, now)}
              </p>
            </div>
            <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Карточка берётся из полной очереди: после смены статуса заявка не пропадает из-за фильтра. */
function RequestPanel({ id, filter }: { id: string; filter: StaffFilter }) {
  const query = useStaffRequests();
  const back = (
    <Link
      to={staffHref(filter)}
      className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-3 self-start lg:hidden")}
    >
      <ArrowLeft aria-hidden />К очереди
    </Link>
  );
  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <ListSkeleton rows={2} label="Загружаем заявку…" />
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <ErrorState description={retryHint(query.error)} onRetry={() => query.refetch()} />
      </div>
    );
  }
  const item = query.data.find((r) => r.id === id);
  return (
    <div className="flex flex-col gap-4">
      {back}
      {item ? (
        <RequestCard key={item.id} item={item} />
      ) : (
        <EmptyState
          icon={SearchX}
          title="Заявка не найдена"
          description="Возможно, ссылка устарела. Выберите заявку из очереди."
        />
      )}
    </div>
  );
}

function RequestCard({ item }: { item: StaffRequestItem }) {
  const now = new Date();
  return (
    <Card aria-labelledby="staff-request-title" className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <CardTitle id="staff-request-title" className="text-lg">
          {requestTypeLabel(item.type)}
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <RequestStatusBadge status={item.status} />
          <span>Подана {formatDateTime(item.createdAt, now)}</span>
        </div>
        <p>
          <span className="font-semibold">{item.student.fullName}</span>
          <span className="text-muted-foreground"> · группа {item.student.group}</span>
        </p>
      </header>

      <section aria-labelledby="staff-request-comment">
        <h3 id="staff-request-comment" className="mb-1 text-sm text-muted-foreground">
          Комментарий студента
        </h3>
        <p className="break-words whitespace-pre-line">{item.comment ?? "Без комментария"}</p>
      </section>

      <section aria-labelledby="staff-request-history">
        <h3 id="staff-request-history" className="mb-3 text-sm font-semibold">
          История
        </h3>
        <RequestTimeline history={item.history} now={now} commentLabel="Комментарий" />
      </section>

      <StatusForm item={item} />
    </Card>
  );
}

function StatusForm({ item }: { item: StaffRequestItem }) {
  const change = useChangeRequestStatus();
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<TargetStatus | null>(null);
  const targets = nextStatuses(item.status);

  const submit = (status: TargetStatus) => {
    const problem = validateStaffComment(status, comment);
    setError(problem);
    if (problem || change.isPending) return;
    const text = comment.trim();
    change.mutate(
      { id: item.id, status, comment: text === "" ? undefined : text },
      {
        onSuccess: () => {
          setComment("");
          setDone(status);
        },
      },
    );
  };

  return (
    <section aria-labelledby="staff-status-title" className="flex flex-col gap-3">
      <h3 id="staff-status-title" className="text-sm font-semibold">
        Сменить статус
      </h3>
      {done && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-lg bg-success-soft p-3 text-sm text-success"
        >
          <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0" />
          <span>
            Статус изменён на «{requestStatusView(done).label}». Студент получит уведомление.
          </span>
        </p>
      )}
      {targets.length === 0 ? (
        <p className="text-sm text-muted-foreground">Заявка закрыта — статус больше не меняется.</p>
      ) : (
        <>
          <Field
            label="Комментарий для студента"
            hint="Необязателен, кроме отказа: при отказе напишите причину."
            error={error ?? undefined}
          >
            {(props) => (
              <Textarea
                {...props}
                value={comment}
                maxLength={1100}
                placeholder="Например: можно забрать в деканате, каб. 112"
                onChange={(e) => {
                  setComment(e.target.value);
                  if (error) setError(null);
                }}
              />
            )}
          </Field>
          {change.isError && (
            <p role="alert" className="text-sm text-danger">
              Не получилось сменить статус. {retryHint(change.error)}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {targets.map((status) => (
              <Button
                key={status}
                variant={status === "rejected" ? "outline" : "primary"}
                className={cn(status === "rejected" && "text-danger")}
                disabled={change.isPending}
                onClick={() => submit(status)}
              >
                {change.isPending && change.variables?.status === status
                  ? "Сохраняем…"
                  : statusActionLabel(status)}
              </Button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
