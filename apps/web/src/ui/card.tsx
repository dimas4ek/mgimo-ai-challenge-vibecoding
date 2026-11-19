import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

/** Карточка — основной контейнер блоков на экранах. */
export function Card({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cn("rounded-lg border border-border bg-surface p-4 shadow-card sm:p-5", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("mb-3 flex items-start justify-between gap-3", className)} {...props} />
  );
}

/** Заголовок карточки. По умолчанию `h2`; уровень меняется через `as`. */
export function CardTitle({
  className,
  as: Tag = "h2",
  ...props
}: ComponentProps<"h2"> & { as?: "h2" | "h3" }) {
  return <Tag className={cn("text-base font-semibold leading-snug", className)} {...props} />;
}

export function CardDescription({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}
