import {
  Bell,
  CalendarDays,
  FileText,
  GraduationCap,
  House,
  type LucideIcon,
  Menu,
  Moon,
  Sun,
  UserRound,
} from "lucide-react";
import { Link, NavLink, Outlet } from "react-router";
import { cn } from "../lib/cn";
import { Button } from "../ui";
import { Disclaimer, Logo } from "./brand";
import { paths } from "./paths";
import { useTheme } from "./theme";

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean };

/** Основные разделы: нижний таб-бар на телефоне и верх бокового меню на десктопе. */
const primaryNav: NavItem[] = [
  { to: paths.home, label: "Главная", icon: House, end: true },
  { to: paths.schedule, label: "Расписание", icon: CalendarDays },
  { to: paths.grades, label: "Успеваемость", icon: GraduationCap },
  { to: paths.requests, label: "Заявки", icon: FileText },
];

/** Второстепенные: на телефоне живут во вкладке «Ещё», на десктопе — в меню. */
export const secondaryNav: NavItem[] = [
  { to: paths.notifications, label: "Уведомления", icon: Bell },
  { to: paths.profile, label: "Профиль", icon: UserRound },
];

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={dark ? "Включить светлую тему" : "Включить тёмную тему"}
    >
      {dark ? <Sun aria-hidden /> : <Moon aria-hidden />}
    </Button>
  );
}

function SidebarLink({ to, label, icon: Icon, end }: NavItem) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
          isActive
            ? "bg-primary-soft text-primary-soft-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )
      }
    >
      <Icon aria-hidden className="size-5" />
      {label}
    </NavLink>
  );
}

function TabLink({ to, label, icon: Icon, end }: NavItem) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium",
          isActive ? "text-primary" : "text-muted-foreground",
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              "grid h-7 w-12 place-items-center rounded-full transition-colors",
              isActive && "bg-primary-soft",
            )}
          >
            <Icon aria-hidden className="size-5" />
          </span>
          <span className="max-w-full truncate">{label}</span>
        </>
      )}
    </NavLink>
  );
}

/**
 * Каркас кабинета: шапка, боковое меню (≥ lg), нижний таб-бар (< lg), подвал с дисклеймером.
 * Страницы рендерятся в `<Outlet />` внутри `<main id="main">`.
 */
export function AppShell() {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-surface px-4 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Перейти к содержимому
      </a>

      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-border bg-surface px-4 py-5 lg:flex">
        <Link to={paths.home} className="rounded-md px-2" aria-label="AI High School — на главную">
          <Logo />
        </Link>
        <nav aria-label="Разделы" className="flex flex-col gap-1">
          {primaryNav.map((item) => (
            <SidebarLink key={item.to} {...item} />
          ))}
          <div className="my-2 border-t border-border" />
          {secondaryNav.map((item) => (
            <SidebarLink key={item.to} {...item} />
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-3">
          <ThemeToggle />
          <Disclaimer />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border bg-background/90 px-4 py-2 backdrop-blur lg:hidden">
          <Link to={paths.home} className="rounded-md" aria-label="AI High School — на главную">
            <Logo />
          </Link>
          <div className="flex items-center">
            <ThemeToggle />
            <Link
              to={paths.notifications}
              aria-label="Уведомления"
              className="grid size-11 place-items-center rounded-md text-foreground hover:bg-muted"
            >
              <Bell aria-hidden className="size-5" />
            </Link>
          </div>
        </header>

        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-8 sm:px-6 lg:px-8 lg:pt-8 lg:pb-10"
        >
          <Outlet />
        </main>

        <footer className="px-4 pb-[calc(var(--spacing-tabbar)+1rem)] text-center lg:hidden">
          <Disclaimer />
        </footer>
      </div>

      <nav
        aria-label="Разделы"
        className="fixed inset-x-0 bottom-0 z-40 flex h-tabbar items-stretch border-t border-border bg-surface/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        {primaryNav.map((item) => (
          <TabLink key={item.to} {...item} />
        ))}
        <TabLink to={paths.more} label="Ещё" icon={Menu} />
      </nav>
    </div>
  );
}
