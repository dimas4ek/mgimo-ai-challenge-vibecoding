import type { Role } from "@aihs/contract";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useMe } from "../api/hooks";
import { ErrorState, ListSkeleton } from "../ui";
import { paths } from "./paths";

/** Домашняя страница роли: студент → `paths.home`, сотрудник → `paths.staff`. */
export function homeOf(role: Role): string {
  return role === "staff" ? paths.staff : paths.home;
}

/**
 * Куда вернуться после входа: только внутренний путь (`/…`, но не `//…`) и не сам вход.
 * Иначе `null` — тогда ведём на домашнюю страницу роли. Защита от open redirect через `?next=`.
 */
export function safeNext(next: string | null): string | null {
  if (!next?.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return null;
  }
  return next === paths.login || next.startsWith(`${paths.login}?`) ? null : next;
}

/** Адрес входа с возвратом на `from`. */
export function loginWithNext(from: string): string {
  return from === paths.home ? paths.login : `${paths.login}?next=${encodeURIComponent(from)}`;
}

/**
 * Охрана маршрутов. Пускает только вошедшего пользователя с ролью `allow`
 * (проп не `role`: так Biome принял бы его за ARIA-роль):
 * не вошёл → `/login?next=<текущий путь>`; другая роль → `homeOf(своя роль)`;
 * пока `useMe` грузится — скелет; ошибка сети — `ErrorState` с повтором.
 * Это удобство UI, защиту данных делает сервер (`requireRole`).
 * Использование в роутере: `{ element: <RequireRole allow="staff"><Outlet /></RequireRole>, children }`.
 */
export function RequireRole({ allow, children }: { allow: Role; children: ReactNode }) {
  const me = useMe();
  const location = useLocation();
  if (me.isPending) return <ListSkeleton label="Проверяем вход…" />;
  if (me.isError) {
    return (
      <ErrorState
        title="Не удалось связаться с сервером"
        description="Проверьте подключение к интернету."
        onRetry={() => me.refetch()}
      />
    );
  }
  if (!me.data) {
    return <Navigate to={loginWithNext(location.pathname + location.search)} replace />;
  }
  if (me.data.role !== allow) return <Navigate to={homeOf(me.data.role)} replace />;
  return children;
}
