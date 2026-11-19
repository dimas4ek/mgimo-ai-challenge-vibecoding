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
import { CertificatePage } from "../features/certificates/CertificatePage";
import { VerifyPage } from "../features/certificates/VerifyPage";
import { GradesPage } from "../features/grades/GradesPage";
import { HomePage } from "../features/home/HomePage";
import { MorePage } from "../features/more/MorePage";
import { NotificationsPage } from "../features/notifications/NotificationsPage";
import { ProfilePage } from "../features/profile/ProfilePage";
import { RequestPage } from "../features/requests/RequestPage";
import { RequestsPage } from "../features/requests/RequestsPage";
import { SchedulePage } from "../features/schedule/SchedulePage";
import { StaffPage } from "../features/staff/StaffPage";
import { buttonVariants, EmptyState, ErrorState } from "../ui";
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
  { path: paths.login, element: <LoginPage />, errorElement: <RouteError /> },
  { path: paths.verifyPattern, element: <VerifyPage />, errorElement: <RouteError /> },
  { path: paths.certificatePattern, element: <CertificatePage />, errorElement: <RouteError /> },
  {
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      {
        element: studentOnly,
        children: [
          { path: paths.home, element: <HomePage /> },
          { path: paths.schedule, element: <SchedulePage /> },
          { path: paths.grades, element: <GradesPage /> },
          { path: paths.requests, element: <RequestsPage /> },
          { path: paths.requestPattern, element: <RequestPage /> },
          { path: paths.notifications, element: <NotificationsPage /> },
          { path: paths.profile, element: <ProfilePage /> },
          { path: paths.more, element: <MorePage /> },
        ],
      },
      { element: staffOnly, children: [{ path: paths.staff, element: <StaffPage /> }] },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routeTree);
}
