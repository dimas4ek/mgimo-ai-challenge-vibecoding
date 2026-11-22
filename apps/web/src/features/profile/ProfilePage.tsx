import { Link } from "react-router";
import { retryHint } from "../../api";
import { useProfile } from "../../api/hooks";
import { paths } from "../../app/paths";
import { Card, CardTitle, ErrorState, PageHeader, Skeleton } from "../../ui";
import { LogoutButton } from "../auth/LogoutButton";
import { DemoResetCard } from "./DemoResetCard";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 sm:flex-row sm:gap-4">
      <dt className="text-sm text-muted-foreground sm:w-48 sm:shrink-0">{label}</dt>
      <dd className="min-w-0 font-medium break-words">{value}</dd>
    </div>
  );
}

/**
 * Профиль и выход.
 * Дисклеймер уже есть в подвале (телефон) и сайдбаре (десктоп) AppShell — второй раз не выводим.
 */
export function ProfilePage() {
  const profile = useProfile();
  return (
    <>
      <PageHeader title="Профиль" />
      {profile.isPending ? (
        <div role="status" aria-live="polite" className="flex flex-col gap-3">
          <span className="sr-only">Загружаем профиль…</span>
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-56 w-full rounded-lg" />
        </div>
      ) : profile.isError ? (
        <ErrorState description={retryHint(profile.error)} onRetry={() => profile.refetch()} />
      ) : (
        <div className="flex flex-col gap-4">
          <Card>
            <CardTitle as="h2">
              {[profile.data.lastName, profile.data.firstName, profile.data.middleName]
                .filter(Boolean)
                .join(" ")}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Группа{" "}
              <Link className="text-primary underline underline-offset-4" to={paths.group}>
                {profile.data.group}
              </Link>{" "}
              · {profile.data.course} курс
            </p>
          </Card>
          <Card>
            <CardTitle as="h2">Учёба</CardTitle>
            <dl className="mt-2 divide-y divide-border">
              <Row label="Факультет" value={profile.data.faculty} />
              <Row label="Направление" value={profile.data.program} />
              <Row label="Зачётная книжка" value={profile.data.recordBookNumber} />
              <Row label="Почта" value={profile.data.email} />
            </dl>
          </Card>
          <DemoResetCard />
        </div>
      )}
      <LogoutButton className="mt-6 w-full sm:w-auto" />
    </>
  );
}
