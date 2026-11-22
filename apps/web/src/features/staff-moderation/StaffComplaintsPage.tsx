import type { DiscussionReportStatus, StaffDiscussionReport } from "@aihs/contract";
import { ArrowLeft, Flag } from "lucide-react";
import { Link, useParams } from "react-router";
import { isApiError, retryHint } from "../../api/client";
import { paths } from "../../app/paths";
import {
  Badge,
  type BadgeTone,
  Button,
  buttonVariants,
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  PageHeader,
} from "../../ui";
import { formatDateTime } from "../requests/model";
import { useResolveStaffComplaint, useStaffComplaint, useStaffComplaints } from "./queries";

const statuses: Record<DiscussionReportStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: "На рассмотрении", tone: "warning" },
  hidden: { label: "Комментарий скрыт", tone: "info" },
  dismissed: { label: "Жалоба отклонена", tone: "neutral" },
};

function Status({ status }: { status: DiscussionReportStatus }) {
  const { label, tone } = statuses[status];
  return <Badge tone={tone}>{label}</Badge>;
}

function ReportTime({ at }: { at: string }) {
  return <time dateTime={at}>{formatDateTime(at, new Date())}</time>;
}

function ComplaintQueue() {
  const query = useStaffComplaints();
  if (query.isPending) return <ListSkeleton label="Загружаем жалобы…" />;
  if (query.isError)
    return (
      <ErrorState
        title="Не удалось загрузить жалобы"
        description={retryHint(query.error)}
        onRetry={() => void query.refetch()}
      />
    );
  if (!query.data.length) return <EmptyState icon={Flag} title="Жалоб пока нет" />;

  return (
    <ul className="flex flex-col gap-3">
      {query.data.map((report) => (
        <li key={report.id}>
          <Card className="p-0 sm:p-0">
            <Link
              to={paths.staffComplaint(report.id)}
              className="block min-h-11 rounded-lg p-4 hover:bg-muted sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="wrap-anywhere font-semibold">{report.topic.title}</h2>
                <Status status={report.status} />
              </div>
              <p className="mt-2 line-clamp-2 wrap-anywhere">{report.reason}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                <ReportTime at={report.createdAt} />
              </p>
            </Link>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function StaffComplaintsPage() {
  return (
    <>
      <PageHeader title="Жалобы" />
      <ComplaintQueue />
    </>
  );
}

function DecisionActions({ id }: { id: string }) {
  const decision = useResolveStaffComplaint(id);
  return (
    <div className="flex flex-col items-start gap-3">
      {decision.isError && (
        <p role="alert" className="text-sm text-danger">
          {isApiError(decision.error, 409)
            ? "По жалобе уже принято решение."
            : retryHint(decision.error)}
        </p>
      )}
      <div className="flex flex-wrap gap-2" aria-busy={decision.isPending}>
        <Button
          variant="danger"
          disabled={decision.isPending}
          onClick={() => decision.mutate({ decision: "hide" })}
        >
          Скрыть комментарий
        </Button>
        <Button
          variant="outline"
          disabled={decision.isPending}
          onClick={() => decision.mutate({ decision: "dismiss" })}
        >
          Отклонить жалобу
        </Button>
      </div>
    </div>
  );
}

function Complaint({ report }: { report: StaffDiscussionReport }) {
  return (
    <div className="flex flex-col gap-4">
      <Card className="wrap-anywhere">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="font-semibold">Причина жалобы</h2>
          <Status status={report.status} />
        </div>
        <p className="mt-2 whitespace-pre-wrap">{report.reason}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Отправлена <ReportTime at={report.createdAt} />
        </p>
        {report.resolvedAt && (
          <p className="mt-1 text-sm text-muted-foreground">
            Решение принято <ReportTime at={report.resolvedAt} />
          </p>
        )}
      </Card>
      <Card className="wrap-anywhere">
        <h2 className="font-semibold">Комментарий</h2>
        <p className="mt-1 text-sm text-muted-foreground">Тема «{report.topic.title}»</p>
        <p className="text-sm text-muted-foreground">
          {report.comment.author.displayName} · <ReportTime at={report.comment.createdAt} />
        </p>
        <p className="mt-3 whitespace-pre-wrap">{report.comment.body}</p>
      </Card>
      {report.status === "pending" && <DecisionActions id={report.id} />}
    </div>
  );
}

function ComplaintDetail({ id }: { id: string }) {
  const query = useStaffComplaint(id);
  if (query.isPending) return <ListSkeleton label="Загружаем жалобу…" />;
  if (query.isError) {
    if (isApiError(query.error, 404)) return <EmptyState title="Жалоба не найдена" />;
    return (
      <ErrorState
        title="Не удалось загрузить жалобу"
        description={retryHint(query.error)}
        onRetry={() => void query.refetch()}
      />
    );
  }
  return <Complaint report={query.data} />;
}

export function StaffComplaintPage() {
  const { id = "" } = useParams();
  return (
    <>
      <Link
        to={paths.staffComplaints}
        className={buttonVariants({ variant: "ghost", className: "mb-3" })}
      >
        <ArrowLeft aria-hidden /> К жалобам
      </Link>
      <PageHeader title="Жалоба" />
      <ComplaintDetail key={id} id={id} />
    </>
  );
}
