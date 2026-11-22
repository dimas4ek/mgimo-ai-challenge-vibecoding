import { CreateDiscussionReportInputSchema } from "@aihs/contract";
import { Ellipsis } from "lucide-react";
import { type FormEvent, type ReactElement, useId, useRef, useState } from "react";
import { isApiError, retryHint } from "../../api/client";
import { Button, Field, Textarea } from "../../ui";
import { useReportDiscussionComment } from "./queries";

export type CommentReportActionProps = {
  /** Стабильный ID видимого комментария для `routes.me.discussions.report`. */
  commentId: string;
};

/** Действие в карточке комментария. Подтверждение показывается после ответа API. */
export function CommentReportAction({ commentId }: CommentReportActionProps): ReactElement {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [invalid, setInvalid] = useState(false);
  const report = useReportDiscussionComment(commentId);
  const duplicate = isApiError(report.error, 409) && report.error.code === "duplicate_report";
  const complete = report.isSuccess || duplicate;

  function openForm() {
    setMenuOpen(false);
    setReason("");
    setInvalid(false);
    report.reset();
    dialog.current?.showModal();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = CreateDiscussionReportInputSchema.safeParse({ reason });
    setInvalid(!input.success);
    if (input.success) report.mutate(input.data);
  }

  return (
    <div className="relative shrink-0">
      <Button
        ref={trigger}
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Действия с комментарием"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(!menuOpen)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setMenuOpen(false);
        }}
      >
        <Ellipsis aria-hidden />
      </Button>
      {menuOpen && (
        <div className="absolute end-0 top-full z-10 rounded-md border border-border bg-surface p-1 shadow-card">
          <Button
            type="button"
            variant="ghost"
            onClick={openForm}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setMenuOpen(false);
                trigger.current?.focus();
              }
            }}
          >
            Пожаловаться
          </Button>
        </div>
      )}
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onClose={() => trigger.current?.focus()}
        onCancel={(event) => {
          if (report.isPending) event.preventDefault();
        }}
        className="m-auto max-h-[calc(100%-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-lg border border-border bg-surface p-4 text-foreground shadow-card backdrop:bg-muted/80"
      >
        <h3 id={titleId} className="mb-3 text-lg font-semibold">
          Жалоба на комментарий
        </h3>
        {complete ? (
          <div className="flex flex-col items-start gap-3">
            <p role="status">
              {duplicate ? "Вы уже отправили жалобу на этот комментарий." : "Жалоба отправлена."}
            </p>
            <Button type="button" onClick={() => dialog.current?.close()}>
              Закрыть
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <Field label="Причина жалобы" error={invalid ? "Укажите причину жалобы." : undefined}>
              {(field) => (
                <Textarea
                  {...field}
                  value={reason}
                  onChange={(event) => {
                    setReason(event.target.value);
                    setInvalid(false);
                  }}
                  maxLength={500}
                  disabled={report.isPending}
                />
              )}
            </Field>
            {report.isError && (
              <p role="alert" className="text-sm text-danger">
                {isApiError(report.error, 404)
                  ? "Комментарий больше недоступен."
                  : retryHint(report.error)}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={report.isPending}>
                {report.isPending ? "Отправляем…" : "Отправить жалобу"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={report.isPending}
                onClick={() => dialog.current?.close()}
              >
                Отмена
              </Button>
            </div>
          </form>
        )}
      </dialog>
    </div>
  );
}
