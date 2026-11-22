import type { Role } from "@aihs/contract";
import {
  Bell,
  CalendarDays,
  FileText,
  GraduationCap,
  House,
  Inbox,
  type LucideIcon,
  Menu,
  MessagesSquare,
  Moon,
  Sun,
  UserRound,
} from "lucide-react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { useMe } from "../api";
import { LogoutButton } from "../features/auth/LogoutButton";
import { UnreadBadge, UnreadCountText } from "../features/notifications/UnreadBadge";
import { cn } from "../lib/cn";
import { Button } from "../ui";
import { Disclaimer, Logo } from "./brand";
import { homeOf } from "./guards";
import { morePaths, paths } from "./paths";
import { StudentTips } from "./StudentTips";
import { useTheme } from "./theme";
import { useCyberGlitch } from "./useCyberGlitch";

export type NavItem = {
  to: string;
  label: string;
  /** Подпись в таб-баре, если полная не влезает в 360 px. */
  shortLabel?: string;
  icon: LucideIcon;
  end?: boolean;
  /** Показать число непрочитанных уведомлений. */
  unread?: boolean;
};

/** Основные разделы: нижний таб-бар на телефоне и верх бокового меню на десктопе. */
const primaryNav: NavItem[] = [
  { to: paths.home, label: "Главная", icon: House, end: true },
  { to: paths.schedule, label: "Расписание", icon: CalendarDays },
  { to: paths.grades, label: "Успеваемость", shortLabel: "Оценки", icon: GraduationCap },
  { to: paths.requests, label: "Заявки", icon: FileText },
];

/** Второстепенные: на телефоне живут во вкладке «Ещё», на десктопе — в меню. */
export const secondaryNav: NavItem[] = [
  { to: paths.discussions, label: "Обсуждения", icon: MessagesSquare },
  { to: paths.notifications, label: "Уведомления", icon: Bell, unread: true },
  { to: paths.profile, label: "Профиль", icon: UserRound },
];

/** Кабинет сотрудника: один раздел — очередь заявок. */
const staffNav: NavItem[] = [{ to: paths.staff, label: "Заявки студентов", icon: Inbox }];

/**
 * Навигация по роли. Студенту — его разделы, таб-бар и колокольчик. Сотруднику — только
 * «Заявки студентов» в меню, без таб-бара и колокольчика (студенческие страницы ему закрыты),
 * а выход — кнопкой в шапке, потому что вкладки «Ещё» у него нет. Пока роль неизвестна — как студенту.
 */
export function navFor(role: Role | undefined): {
  primary: NavItem[];
  secondary: NavItem[];
  /** Нижний таб-бар и колокольчик (только студент). */
  studentChrome: boolean;
} {
  if (role === "staff") return { primary: staffNav, secondary: [], studentChrome: false };
  return { primary: primaryNav, secondary: secondaryNav, studentChrome: true };
}

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

function SidebarLink({ to, label, icon: Icon, end, unread }: NavItem) {
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
      {unread && <UnreadBadge />}
    </NavLink>
  );
}

/** Вкладка таб-бара. `alsoActiveOn` — пути, на которых вкладка тоже подсвечена («Ещё» → профиль). */
function TabLink({
  to,
  label,
  shortLabel,
  icon: Icon,
  end,
  alsoActiveOn,
  unread,
}: NavItem & { alsoActiveOn?: readonly string[] }) {
  const { pathname } = useLocation();
  const extra = alsoActiveOn?.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ?? false;
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium",
          isActive || extra ? "text-primary" : "text-muted-foreground",
        )
      }
    >
      {({ isActive: own }) => {
        const isActive = own || extra;
        return (
          <>
            <span
              className={cn(
                "relative grid h-7 w-12 place-items-center rounded-full transition-colors",
                isActive && "bg-primary-soft",
              )}
            >
              <Icon aria-hidden className="size-5" />
              {unread && <UnreadBadge variant="dot" announce={false} />}
            </span>
            <span className="max-w-full truncate">{shortLabel ?? label}</span>
            {unread && <UnreadCountText />}
          </>
        );
      }}
    </NavLink>
  );
}

/**
 * Каркас кабинета: шапка, боковое меню (≥ lg), нижний таб-бар (< lg), подвал с дисклеймером.
 * Страницы рендерятся в `<Outlet />` внутри `<main id="main">`.
 */
export function AppShell() {
  const me = useMe();
  const cyberGlitch = useCyberGlitch();
  const role = me.data?.role;
  const nav = navFor(role);
  const home = role ? homeOf(role) : paths.home;
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      {cyberGlitch && <div className="cyber-glitch" aria-hidden="true" />}
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-surface px-4 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Перейти к содержимому
      </a>

      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-border bg-surface px-4 py-5 lg:flex">
        <Link
          to={home}
          className="flex min-h-11 items-center rounded-md px-2"
          aria-label="AI High School — на главную"
        >
          <Logo />
        </Link>
        <nav aria-label="Разделы" className="flex flex-col gap-1">
          {nav.primary.map((item) => (
            <SidebarLink key={item.to} {...item} />
          ))}
          {nav.secondary.length > 0 && <div className="my-2 border-t border-border" />}
          {nav.secondary.map((item) => (
            <SidebarLink key={item.to} {...item} />
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-3">
          <ThemeToggle />
          {!nav.studentChrome && <LogoutButton variant="ghost" className="justify-start" />}
          <Disclaimer />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border bg-background/90 px-4 py-2 backdrop-blur lg:hidden">
          <Link
            to={home}
            className="flex min-h-11 items-center rounded-md"
            aria-label="AI High School — на главную"
          >
            <Logo />
          </Link>
          <div className="flex items-center">
            <ThemeToggle />
            {nav.studentChrome ? (
              <Link
                to={paths.notifications}
                className="relative grid size-11 place-items-center rounded-md text-foreground hover:bg-muted"
              >
                <Bell aria-hidden className="size-5" />
                <span className="sr-only">Уведомления</span>
                <UnreadBadge variant="dot" className="top-0.5 right-0.5" announce={false} />
                <UnreadCountText />
              </Link>
            ) : (
              <LogoutButton variant="ghost" size="sm" />
            )}
          </div>
        </header>

        <div
          className={cn(
            "flex flex-1 flex-col",
            role === "student" &&
              "min-[90rem]:grid min-[90rem]:grid-cols-[minmax(0,64rem)_17rem] min-[90rem]:pr-8",
          )}
        >
          <main
            id="main"
            tabIndex={-1}
            className="mx-auto w-full min-w-0 max-w-5xl flex-1 px-4 pt-5 pb-8 sm:px-6 lg:px-8 lg:pt-8 lg:pb-10"
          >
            <Outlet />
          </main>
          {role === "student" && <StudentTips />}
        </div>

        <footer
          className={cn(
            "px-4 text-center lg:hidden",
            nav.studentChrome ? "pb-[calc(var(--spacing-tabbar)+1rem)]" : "pb-6",
          )}
        >
          <Disclaimer />
        </footer>
      </div>

      {nav.studentChrome && (
        <nav
          aria-label="Разделы"
          className="fixed inset-x-0 bottom-0 z-40 flex h-tabbar items-stretch border-t border-border bg-surface/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        >
          {nav.primary.map((item) => (
            <TabLink key={item.to} {...item} />
          ))}
          <TabLink to={paths.more} label="Ещё" icon={Menu} alsoActiveOn={morePaths} unread />
        </nav>
      )}
    </div>
  );
}
