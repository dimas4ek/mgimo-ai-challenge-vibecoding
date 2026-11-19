import type { ReactNode } from "react";

type PageHeaderProps = {
  /** Заголовок экрана, единственный `h1` на странице. */
  title: string;
  description?: ReactNode;
  /** Кнопки справа от заголовка (на телефоне переносятся вниз). */
  actions?: ReactNode;
};

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-balance">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
