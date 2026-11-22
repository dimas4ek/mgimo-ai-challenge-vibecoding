import { SearchX } from "lucide-react";
import {
  createBrowserRouter,
  isRouteErrorResponse,
  Link,
  Outlet,
  type RouteObject,
  useRouteError,
} from "react-router";
import { LoginPage } from "../features/auth/LoginPage";
import { HomePage } from "../features/home/HomePage";
import { buttonVariants, EmptyState, ErrorState, ListSkeleton, Skeleton } from "../ui";
import { AppShell } from "./AppShell";
import { RequireRole } from "./guards";
import { paths } from "./paths";

function NotFoundPage() {
  return (
    <>
      <h1 className="sr-only">Страница не найдена</h1>
      <EmptyState
        icon={SearchX}
        title="Такой страницы нет"
        description="Возможно, ссылка устарела."
        action={
          <Link to={paths.home} className={buttonVariants({ variant: "outline" })}>
            На главную
          </Link>
        }
      />
    </>
  );
}

function RouteError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  return (
    <main id="main" className="mx-auto max-w-md p-4 pt-10">
      <ErrorState
        title="Что-то пошло не так"
        description="Обновите страницу. Если не поможет — зайдите чуть позже."
        onRetry={() => window.location.reload()}
      />
    </main>
  );
}

/**
 * Пока при первом открытии грузится файл страницы (страницы, кроме входа, каркаса и главной,
 * собираются отдельными файлами), показываем скелет кабинета, а не пустой экран.
 */
function PageSkeleton() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 pt-5">
      <Skeleton className="h-11 w-full rounded-lg" />
      <Skeleton className="h-8 w-48" />
      <ListSkeleton rows={3} label="Загружаем страницу…" />
    </main>
  );
}

const studentOnly = (
  <RequireRole allow="student">
    <Outlet />
  </RequireRole>
);
const staffOnly = (
  <RequireRole allow="staff">
    <Outlet />
  </RequireRole>
);

/**
 * Дерево страниц. Кабинет студента и кабинет сотрудника закрыты `RequireRole`:
 * не вошёл → вход с возвратом, чужая роль → домашняя страница своей роли.
 */
export const routeTree: RouteObject[] = [
  // Вне AppShell: вход, публичная проверка справки, печатная форма.
  {
    path: paths.login,
    element: <LoginPage />,
    errorElement: <RouteError />,
    hydrateFallbackElement: <PageSkeleton />,
  },
  {
    path: paths.verifyPattern,
    lazy: () =>
      import("../features/certificates/VerifyPage").then((m) => ({ Component: m.VerifyPage })),
    errorElement: <RouteError />,
    hydrateFallbackElement: <PageSkeleton />,
  },
  // Печатная справка — без AppShell, но только для вошедшего студента.
  {
    element: studentOnly,
    errorElement: <RouteError />,
    hydrateFallbackElement: <PageSkeleton />,
    children: [
      {
        path: paths.certificatePattern,
        lazy: () =>
          import("../features/certificates/CertificatePage").then((m) => ({
            Component: m.CertificatePage,
          })),
      },
    ],
  },
  {
    element: <AppShell />,
    errorElement: <RouteError />,
    hydrateFallbackElement: <PageSkeleton />,
    children: [
      {
        element: studentOnly,
        children: [
          { path: paths.home, element: <HomePage /> },
          {
            path: paths.schedule,
            lazy: () =>
              import("../features/schedule/SchedulePage").then((m) => ({
                Component: m.SchedulePage,
              })),
          },
          {
            path: paths.grades,
            lazy: () =>
              import("../features/grades/GradesPage").then((m) => ({ Component: m.GradesPage })),
          },
          {
            path: paths.requests,
            lazy: () =>
              import("../features/requests/RequestsPage").then((m) => ({
                Component: m.RequestsPage,
              })),
          },
          {
            path: paths.discussions,
            lazy: () =>
              import("../features/discussions/DiscussionsPage").then((m) => ({
                Component: m.DiscussionsPage,
              })),
          },
          {
            path: paths.discussionPattern,
            lazy: () =>
              import("../features/discussions/DiscussionPage").then((m) => ({
                Component: m.DiscussionPage,
              })),
          },
          {
            path: paths.requestPattern,
            lazy: () =>
              import("../features/requests/RequestPage").then((m) => ({
                Component: m.RequestPage,
              })),
          },
          {
            path: paths.notifications,
            lazy: () =>
              import("../features/notifications/NotificationsPage").then((m) => ({
                Component: m.NotificationsPage,
              })),
          },
          {
            path: paths.profile,
            lazy: () =>
              import("../features/profile/ProfilePage").then((m) => ({ Component: m.ProfilePage })),
          },
          {
            path: paths.more,
            lazy: () =>
              import("../features/more/MorePage").then((m) => ({ Component: m.MorePage })),
          },
        ],
      },
      {
        element: staffOnly,
        children: [
          {
            path: paths.staff,
            lazy: () =>
              import("../features/staff/StaffPage").then((m) => ({ Component: m.StaffPage })),
          },
        ],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routeTree);
}
