import type { Role } from "@aihs/contract";
import type { ReactNode } from "react";

/** Домашняя страница роли: студент → `paths.home`, сотрудник → `paths.staff`. */
export function homeOf(_role: Role): string {
  throw new Error("not implemented");
}

/**
 * Охрана маршрутов. Пускает только вошедшего пользователя с ролью `role`:
 * не вошёл → `/login?next=<текущий путь>`; другая роль → `homeOf(своя роль)`;
 * пока `useMe` грузится — скелет; ошибка сети — `ErrorState` с повтором.
 * Это удобство UI, защиту данных делает сервер (`requireRole`).
 * Использование в роутере: `{ element: <RequireRole role="staff"><Outlet /></RequireRole>, children }`.
 */
export function RequireRole({ children }: { role: Role; children: ReactNode }) {
  return children;
}
