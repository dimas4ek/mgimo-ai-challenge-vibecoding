import { AlertTriangle, Inbox, type LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn";
import { Button } from "./button";

/** Плейсхолдер загрузки. Экраны с данными показывают скелетон, а не голый спиннер. */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div aria-hidden className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />
  );
}

/** Готовый скелетон списка из `rows` карточек; объявляет загрузку для скринридера. */
export function ListSkeleton({
  rows = 3,
  label = "Загружаем…",
}: {
  rows?: number;
  label?: string;
}) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: статичный список плейсхолдеров
        <Skeleton key={i} className="h-20 w-full rounded-lg" />
      ))}
    </div>
  );
}

type StateProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  /** Действие: кнопка или ссылка («Заказать справку»). */
  action?: ReactNode;
  className?: string;
};

function StateBox({
  title,
  description,
  icon: Icon,
  action,
  className,
  tone,
}: StateProps & { tone: "muted" | "danger" }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-4 py-10 text-center",
        className,
      )}
    >
      {Icon && (
        <span
          className={cn(
            "grid size-12 place-items-center rounded-full",
            tone === "danger" ? "bg-danger-soft text-danger" : "bg-muted text-muted-foreground",
          )}
        >
          <Icon aria-hidden className="size-6" />
        </span>
      )}
      <div className="flex max-w-sm flex-col gap-1">
        <p className="font-semibold">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Пустое состояние: понятный текст и действие («Заявок пока нет — заказать справку»). */
export function EmptyState({ icon = Inbox, ...props }: StateProps) {
  return <StateBox icon={icon} tone="muted" {...props} />;
}

/** Ошибка загрузки: человеческое сообщение и кнопка «Повторить». */
export function ErrorState({
  title = "Не получилось загрузить",
  description = "Проверьте интернет и попробуйте ещё раз.",
  onRetry,
  className,
}: Partial<Pick<StateProps, "title" | "description" | "className">> & { onRetry?: () => void }) {
  return (
    <div role="alert">
      <StateBox
        icon={AlertTriangle}
        tone="danger"
        title={title}
        description={description}
        className={className}
        action={
          onRetry && (
            <Button variant="outline" onClick={onRetry}>
              Повторить
            </Button>
          )
        }
      />
    </div>
  );
}
