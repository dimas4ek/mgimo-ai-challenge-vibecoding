import { Link } from "react-router";
import { retryHint, useMyGroup } from "../../api";
import { paths } from "../../app/paths";
import { buttonVariants, Card, CardTitle, ErrorState, ListSkeleton, PageHeader } from "../../ui";

export function GroupPage() {
  const group = useMyGroup();
  return (
    <>
      <PageHeader title="Моя группа" />
      {group.isPending ? (
        <ListSkeleton rows={3} label="Загружаем группу…" />
      ) : group.isError ? (
        <ErrorState description={retryHint(group.error)} onRetry={() => group.refetch()} />
      ) : (
        <div className="flex flex-col gap-4">
          <Card>
            <CardTitle as="h2">{group.data.name}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {group.data.course} курс · {group.data.program}
            </p>
            <p className="mt-2 text-sm">Куратор: {group.data.curator ?? "Не назначен"}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link className={buttonVariants()} to={paths.schedule}>
                Открыть расписание
              </Link>
              <a className={buttonVariants({ variant: "outline" })} href="#group-announcements">
                Объявления группы
              </a>
            </div>
          </Card>
          <Card>
            <CardTitle as="h2">Состав группы</CardTitle>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {group.data.members.map((name, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: Строки без состояния, у тёзок одинаковые имена.
                <li key={`${index}-${name}`}>{name}</li>
              ))}
            </ul>
          </Card>
          <section id="group-announcements" className="scroll-mt-6" aria-label="Объявления группы">
            <Card>
              <CardTitle as="h2">Объявления группы</CardTitle>
              {group.data.announcements.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Пока нет объявлений группы.</p>
              ) : (
                <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">
                  {group.data.announcements.map((announcement, index) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: Список строк без состояния и идентификаторов.
                    <li key={`${index}-${announcement}`}>{announcement}</li>
                  ))}
                </ul>
              )}
            </Card>
          </section>
        </div>
      )}
    </>
  );
}
