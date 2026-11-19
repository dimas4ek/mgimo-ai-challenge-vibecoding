import { SearchX } from "lucide-react";
import {
  createBrowserRouter,
  isRouteErrorResponse,
  Link,
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
import { paths } from "./paths";

function NotFoundPage() {
  return (
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
 * Дерево страниц. Охрана маршрутов (вход, роль staff) добавляется задачами #13 и #18
 * через `loader`/обёртку, сами пути не меняются.
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
      { path: paths.home, element: <HomePage /> },
      { path: paths.schedule, element: <SchedulePage /> },
      { path: paths.grades, element: <GradesPage /> },
      { path: paths.requests, element: <RequestsPage /> },
      { path: paths.requestPattern, element: <RequestPage /> },
      { path: paths.notifications, element: <NotificationsPage /> },
      { path: paths.profile, element: <ProfilePage /> },
      { path: paths.more, element: <MorePage /> },
      { path: paths.staff, element: <StaffPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routeTree);
}
