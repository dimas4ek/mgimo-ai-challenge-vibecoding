import { ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { secondaryNav } from "../../app/AppShell";
import { Card, PageHeader } from "../../ui";

/** Вкладка «Ещё» на телефоне: второстепенные разделы. Выход добавит задача #13. */
export function MorePage() {
  return (
    <>
      <PageHeader title="Ещё" />
      <Card className="p-2 sm:p-2">
        <nav aria-label="Другие разделы">
          <ul className="flex flex-col">
            {secondaryNav.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <Link
                  to={to}
                  className="flex min-h-12 items-center gap-3 rounded-md px-3 font-medium hover:bg-muted"
                >
                  <Icon aria-hidden className="size-5 text-muted-foreground" />
                  <span className="flex-1">{label}</span>
                  <ChevronRight aria-hidden className="size-5 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Card>
    </>
  );
}
