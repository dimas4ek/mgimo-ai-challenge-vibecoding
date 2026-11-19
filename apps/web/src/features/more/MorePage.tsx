import { ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { secondaryNav } from "../../app/AppShell";
import { Card, PageHeader } from "../../ui";
import { LogoutButton } from "../auth/LogoutButton";
import { UnreadBadge } from "../notifications/UnreadBadge";

/** Вкладка «Ещё» на телефоне: второстепенные разделы и выход. */
export function MorePage() {
  return (
    <>
      <PageHeader title="Ещё" />
      <Card className="p-2 sm:p-2">
        <nav aria-label="Другие разделы">
          <ul className="flex flex-col">
            {secondaryNav.map(({ to, label, icon: Icon, unread }) => (
              <li key={to}>
                <Link
                  to={to}
                  className="flex min-h-12 items-center gap-3 rounded-md px-3 font-medium hover:bg-muted"
                >
                  <Icon aria-hidden className="size-5 text-muted-foreground" />
                  <span className="flex-1">{label}</span>
                  {unread && <UnreadBadge />}
                  <ChevronRight aria-hidden className="size-5 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Card>
      <LogoutButton block className="mt-6" />
    </>
  );
}
