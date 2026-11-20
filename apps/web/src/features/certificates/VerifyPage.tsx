import { CertificateTokenSchema } from "@aihs/contract";
import { CircleCheck, CircleX, ShieldQuestion } from "lucide-react";
import { useParams } from "react-router";
import { isApiError, retryHint, useVerification } from "../../api";
import { Disclaimer, Logo } from "../../app/brand";
import { Card, ErrorState, Skeleton } from "../../ui";
import { requestTypeLabel } from "../requests/model";
import { formatIssuedOn } from "./model";

function NotFound() {
  return (
    <Card className="flex flex-col items-center gap-3 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-danger-soft text-danger">
        <CircleX aria-hidden className="size-6" />
      </span>
      <h1 className="text-lg font-semibold">Справка не найдена</h1>
      <p className="text-sm text-muted-foreground">
        Проверьте, что QR-код или ссылка скопированы полностью. Если справку выдали в AI High
        School, обратитесь в деканат.
      </p>
    </Card>
  );
}

function Result({ token }: { token: string }) {
  const query = useVerification(token);
  if (query.isPending) {
    return (
      <div role="status" aria-live="polite">
        <h1 className="sr-only">Проверка справки</h1>
        <span className="sr-only">Проверяем справку…</span>
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }
  if (query.isError) {
    if (isApiError(query.error, 404)) return <NotFound />;
    return (
      <>
        <h1 className="sr-only">Проверка справки</h1>
        <ErrorState description={retryHint(query.error)} onRetry={() => query.refetch()} />
      </>
    );
  }
  const v = query.data;
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span
          className={
            v.valid
              ? "grid size-12 shrink-0 place-items-center rounded-full bg-success-soft text-success"
              : "grid size-12 shrink-0 place-items-center rounded-full bg-danger-soft text-danger"
          }
        >
          {v.valid ? (
            <CircleCheck aria-hidden className="size-6" />
          ) : (
            <ShieldQuestion aria-hidden className="size-6" />
          )}
        </span>
        <div>
          <h1 className="text-lg font-semibold">
            {v.valid ? "Справка действительна" : "Справка недействительна"}
          </h1>
          <p className="text-sm text-muted-foreground">Проверка подлинности AI High School</p>
        </div>
      </div>
      <dl className="flex flex-col divide-y divide-border">
        {(
          [
            ["Документ", requestTypeLabel(v.type)],
            ["Номер", v.number],
            ["Дата выдачи", formatIssuedOn(v.issuedOn)],
            ["Кому выдана", v.holderInitials],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 py-2.5">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">
        Для защиты персональных данных показаны только инициалы.
      </p>
    </Card>
  );
}

/**
 * Публичная проверка справки по QR, `/verify/:token`. Без входа и без AppShell.
 * Показывает минимум (`.claude/rules/security.md`): тип, номер, дата, «действительна», инициалы.
 * Токен неверного формата на сервер не отправляем — сразу «не найдена».
 */
export function VerifyPage() {
  const { token = "" } = useParams<"token">();
  const valid = CertificateTokenSchema.safeParse(token).success;
  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10"
    >
      <Logo className="self-center" />
      {valid ? <Result token={token} /> : <NotFound />}
      <Disclaimer className="text-center" />
    </main>
  );
}
