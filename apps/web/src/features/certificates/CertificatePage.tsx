import { ArrowLeft, FileQuestion, Printer } from "lucide-react";
import { Link, useParams } from "react-router";
import { isApiError, useCertificate } from "../../api";
import { Disclaimer, Logo } from "../../app/brand";
import { paths } from "../../app/paths";
import { cn } from "../../lib/cn";
import { Button, buttonVariants, EmptyState, ErrorState, Skeleton } from "../../ui";
import { requestTypeLabel } from "../requests/model";
import { formatIssuedAt, verifyUrl } from "./model";
import { QrCode } from "./QrCode";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[12rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-medium break-words">{value}</dd>
    </div>
  );
}

/**
 * Справка для печати с QR, `/requests/:id/certificate`. Без AppShell, чтобы печать была чистой.
 * Лист всегда светлый (`data-theme="light"`), как бумага; панель с кнопками на печать не попадает.
 * QR ведёт на публичную `/verify/:token`. Справка помечена как образец: вуз и данные вымышлены.
 */
export function CertificatePage() {
  const { id = "" } = useParams<"id">();
  const query = useCertificate(id);
  const back = paths.request(id);

  return (
    <main id="main" className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link to={back} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-3")}>
          <ArrowLeft aria-hidden />К заявке
        </Link>
        {query.isSuccess && (
          <Button onClick={() => window.print()}>
            <Printer aria-hidden />
            Печать или PDF
          </Button>
        )}
      </div>

      {query.isPending ? (
        <div role="status" aria-live="polite">
          <h1 className="sr-only">Справка</h1>
          <span className="sr-only">Загружаем справку…</span>
          <Skeleton className="h-[36rem] w-full rounded-lg" />
        </div>
      ) : query.isError ? (
        isApiError(query.error, 404) ? (
          <>
            <h1 className="sr-only">Справка</h1>
            <EmptyState
              icon={FileQuestion}
              title="Справки пока нет"
              description="Она появится, когда деканат отметит заявку как готовую."
              action={
                <Link to={back} className={buttonVariants({ variant: "outline" })}>
                  К заявке
                </Link>
              }
            />
          </>
        ) : (
          <>
            <h1 className="sr-only">Справка</h1>
            <ErrorState onRetry={() => query.refetch()} />
          </>
        )
      ) : (
        <article
          data-theme="light"
          aria-labelledby="certificate-title"
          className="relative overflow-hidden rounded-lg border border-border bg-surface p-6 text-foreground shadow-card sm:p-10 print:rounded-none print:border-0 print:shadow-none"
        >
          {/* Водяной знак: справка — образец из концепта, а не документ. */}
          <p
            aria-hidden
            className="pointer-events-none absolute inset-0 grid -rotate-30 place-items-center text-6xl font-black tracking-widest text-muted-foreground/10 select-none sm:text-8xl"
          >
            ОБРАЗЕЦ
          </p>
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
            <Logo />
            <p className="text-sm text-muted-foreground sm:text-right">
              № {query.data.number}
              <br />
              от {formatIssuedAt(query.data.issuedAt)}
            </p>
          </header>

          <h1 id="certificate-title" className="mt-6 text-center text-2xl font-bold">
            {requestTypeLabel(query.data.type)}
          </h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            AI High School (Высшая Школа ИИ) подтверждает, что указанное лицо обучается в вузе.
          </p>

          <dl className="mt-6 flex flex-col gap-3">
            <Field label="Студент" value={query.data.student.fullName} />
            <Field label="Зачётная книжка" value={query.data.student.recordBookNumber} />
            <Field label="Факультет" value={query.data.student.faculty} />
            <Field label="Направление" value={query.data.student.program} />
            <Field
              label="Курс и группа"
              value={`${query.data.student.course} курс, группа ${query.data.student.group}`}
            />
            {query.data.purpose && <Field label="Для предоставления" value={query.data.purpose} />}
          </dl>

          <footer className="mt-8 flex flex-col items-center gap-4 border-t border-border pt-6 sm:flex-row sm:items-end">
            <QrCode
              value={verifyUrl(query.data.verifyPath, window.location.origin)}
              label="QR-код для проверки подлинности справки"
              className="size-36 shrink-0"
            />
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <p>
                Подлинность можно проверить по QR-коду или по адресу:{" "}
                <span className="break-all text-foreground">
                  {verifyUrl(query.data.verifyPath, window.location.origin)}
                </span>
              </p>
              <Disclaimer />
            </div>
          </footer>
        </article>
      )}
      {!query.isSuccess && <Disclaimer className="text-center" />}
    </main>
  );
}
