import { Construction } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState, PageHeader } from "../ui";

/**
 * Временная страница раздела. Доменная задача заменяет её своей страницей в `features/<раздел>/`,
 * роутер и навигацию не трогает.
 */
export function StubPage({
  title,
  task,
  children,
}: {
  title: string;
  /** Номер задачи на доске, которая наполнит раздел. */
  task: number;
  children?: ReactNode;
}) {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState
        icon={Construction}
        title="Раздел скоро появится"
        description={`Его наполняет задача #${task}.`}
      />
      {children}
    </>
  );
}
