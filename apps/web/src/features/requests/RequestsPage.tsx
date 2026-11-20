import { type RequestListItem, RequestTypeSchema } from "@aihs/contract";
import { ChevronRight, FilePlus, FileText } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { retryHint, useRequests } from "../../api";
import { paths } from "../../app/paths";
import { Button, EmptyState, ErrorState, ListSkeleton, PageHeader } from "../../ui";
import { formatDateTime, requestTypeLabel, sortRequests } from "./model";
import { NewRequestWizard } from "./NewRequestWizard";
import { RequestStatusBadge } from "./RequestStatusBadge";

/**
 * Заявки и справки: список со статусами и мастер подачи. Мастер открыт, когда в адресе `?new=1`
 * (можно с `&type=enrollment_certificate`), поэтому на него ведут ссылки с главной и из пустого списка.
 */
export function RequestsPage() {
  const [params, setParams] = useSearchParams();
  const creating = params.get("new") === "1";
  const preset = RequestTypeSchema.safeParse(params.get("type"));

  const open = () => setParams({ new: "1" });
  const close = () => setParams({}, { replace: true });

  return (
    <>
      <PageHeader
        title="Заявки и справки"
        description="Закажите справку или подайте заявление — статус будет виден здесь."
        actions={
          !creating && (
            <Button onClick={open}>
              <FilePlus aria-hidden />
              Новая заявка
            </Button>
          )
        }
      />
      {creating ? (
        <NewRequestWizard initialType={preset.success ? preset.data : undefined} onCancel={close} />
      ) : (
        <RequestList onCreate={open} />
      )}
    </>
  );
}

function RequestList({ onCreate }: { onCreate: () => void }) {
  const query = useRequests();
  if (query.isPending) return <ListSkeleton rows={3} label="Загружаем заявки…" />;
  if (query.isError)
    return <ErrorState description={retryHint(query.error)} onRetry={() => query.refetch()} />;
  if (query.data.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Заявок пока нет"
        description="Справка об обучении обычно готова за 1–2 рабочих дня."
        action={<Button onClick={onCreate}>Заказать справку</Button>}
      />
    );
  }
  const now = new Date();
  return (
    <ul className="flex flex-col gap-3">
      {sortRequests(query.data).map((item) => (
        <li key={item.id}>
          <RequestRow item={item} now={now} />
        </li>
      ))}
    </ul>
  );
}

function RequestRow({ item, now }: { item: RequestListItem; now: Date }) {
  return (
    <Link
      to={paths.request(item.id)}
      className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 shadow-card transition-colors hover:bg-muted sm:p-4"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold leading-snug">{requestTypeLabel(item.type)}</span>
          <RequestStatusBadge status={item.status} />
        </div>
        {item.comment && <p className="truncate text-sm text-muted-foreground">{item.comment}</p>}
        <p className="text-xs text-muted-foreground">
          {item.updatedAt === item.createdAt ? "Подана" : "Обновлена"}{" "}
          {formatDateTime(item.updatedAt, now)}
        </p>
      </div>
      <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground" />
    </Link>
  );
}
