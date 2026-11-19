import { REQUEST_CATEGORY, type Request } from "@aihs/contract";
import { ArrowLeft, CircleCheck, FileQuestion, Printer } from "lucide-react";
import { Link, useLocation, useParams } from "react-router";
import { isApiError, useRequest } from "../../api";
import { paths } from "../../app/paths";
import { cn } from "../../lib/cn";
import { buttonVariants, Card, CardTitle, EmptyState, ErrorState, ListSkeleton } from "../../ui";
import { formatDateTime, requestStatusView, requestTypeLabel, timeline } from "./model";
import type { CreatedState } from "./NewRequestWizard";
import { RequestStatusBadge } from "./RequestStatusBadge";

const backLink = (
  <Link
    to={paths.requests}
    className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-3 self-start")}
  >
    <ArrowLeft aria-hidden />
    Все заявки
  </Link>
);

/** Карточка заявки с историей статусов, `/requests/:id`. Чужая или несуществующая — «не найдена». */
export function RequestPage() {
  const { id = "" } = useParams<"id">();
  const location = useLocation();
  const justCreated = (location.state as CreatedState | null)?.created === true;
  const query = useRequest(id);

  return (
    <div className="flex flex-col gap-4">
      {backLink}
      {query.isPending ? (
        <>
          <h1 className="sr-only">Заявка</h1>
          <ListSkeleton rows={2} label="Загружаем заявку…" />
        </>
      ) : query.isError ? (
        isApiError(query.error, 404) ? (
          <>
            <h1 className="sr-only">Заявка не найдена</h1>
            <EmptyState
              icon={FileQuestion}
              title="Заявка не найдена"
              description="Возможно, ссылка устарела. Все ваши заявки — в списке."
              action={
                <Link to={paths.requests} className={buttonVariants({ variant: "outline" })}>
                  К списку заявок
                </Link>
              }
            />
          </>
        ) : (
          <>
            <h1 className="sr-only">Заявка</h1>
            <ErrorState onRetry={() => query.refetch()} />
          </>
        )
      ) : (
        <RequestDetails request={query.data} justCreated={justCreated} />
      )}
    </div>
  );
}

function RequestDetails({ request, justCreated }: { request: Request; justCreated: boolean }) {
  const now = new Date();
  const printable = REQUEST_CATEGORY[request.type] === "certificate" && request.status === "ready";
  return (
    <>
      {justCreated && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-lg bg-success-soft p-3 text-sm text-success"
        >
          <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0" />
          <span>
            <span className="font-semibold">Заявка отправлена.</span> Когда статус изменится, придёт
            уведомление.
          </span>
        </p>
      )}
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-balance">
          {requestTypeLabel(request.type)}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <RequestStatusBadge status={request.status} />
          <span>Подана {formatDateTime(request.createdAt, now)}</span>
        </div>
      </header>

      {request.comment && (
        <Card aria-labelledby="request-comment">
          <CardTitle id="request-comment" className="mb-1 text-sm text-muted-foreground">
            Ваш комментарий
          </CardTitle>
          <p className="break-words whitespace-pre-line">{request.comment}</p>
        </Card>
      )}

      {printable && (
        <Link to={paths.certificate(request.id)} className={buttonVariants({ block: true })}>
          <Printer aria-hidden />
          Справка для печати
        </Link>
      )}

      <Card aria-labelledby="request-history">
        <CardTitle id="request-history" className="mb-4">
          История
        </CardTitle>
        <Timeline request={request} now={now} />
      </Card>
    </>
  );
}

const dotTone = {
  neutral: "bg-muted-foreground",
  info: "bg-info",
  success: "bg-success",
  danger: "bg-danger",
} as const;

function Timeline({ request, now }: { request: Request; now: Date }) {
  const entries = timeline(request.history);
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
                  <span className="text-muted-foreground">Деканат: </span>
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
