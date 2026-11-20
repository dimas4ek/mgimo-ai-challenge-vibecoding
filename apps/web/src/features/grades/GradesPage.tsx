import { BRS_MAX, type DisciplineGrade, type Grades } from "@aihs/contract";
import { CalendarClock, CircleAlert, CircleCheck, Clock, GraduationCap } from "lucide-react";
import { retryHint } from "../../api";
import { useGrades } from "../../api/hooks";
import { cn } from "../../lib/cn";
import { Badge, Card, CardTitle, EmptyState, ErrorState, PageHeader, Skeleton } from "../../ui";
import { ForecastCard } from "./ForecastCard";
import {
  controlFormLabel,
  debtsNote,
  disciplineState,
  examLine,
  formatSessionRange,
  nextExam,
  pluralDays,
  resultLabel,
  sessionPhase,
  sortForDisplay,
  whenLabel,
} from "./model";
import { PastDebts } from "./PastDebts";

/** Полоса заполнения. Цифры всегда рядом текстом, полоса — только подсказка. */
function Bar({
  value,
  max,
  danger = false,
  className,
}: {
  value: number;
  max: number;
  danger?: boolean;
  className?: string;
}) {
  const percent = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div aria-hidden className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className={cn("h-full rounded-full", danger ? "bg-danger" : "bg-primary")}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function SessionLine({ session, now }: { session: NonNullable<Grades["session"]>; now: Date }) {
  const phase = sessionPhase(session, now);
  const when =
    phase.phase === "before"
      ? `через ${pluralDays(phase.daysLeft)}`
      : phase.phase === "ongoing"
        ? "идёт сейчас"
        : "завершена";
  return (
    <p className="flex items-start gap-2 text-sm">
      <CalendarClock aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <span>
        Сессия {formatSessionRange(session)} · <span className="font-semibold">{when}</span>
      </span>
    </p>
  );
}

/** Блок «Ближайший экзамен» (#33): скрыт, если дат нет или все экзамены уже прошли. */
function NextExamCard({ disciplines, now }: { disciplines: DisciplineGrade[]; now: Date }) {
  const next = nextExam(disciplines, now);
  if (!next) return null;
  return (
    <Card aria-labelledby="next-exam-title" className="border-primary">
      <p className="flex items-center gap-2 text-sm font-semibold text-primary">
        <CalendarClock aria-hidden className="size-4" />
        <span id="next-exam-title">Ближайший экзамен</span>
        <span className="text-muted-foreground">· {whenLabel(next.daysLeft)}</span>
      </p>
      <h2 className="mt-2 text-lg font-semibold text-balance">{next.discipline.subject}</h2>
      <p className="mt-0.5 text-sm">{examLine(next.discipline)}</p>
    </Card>
  );
}

function Summary({ grades, now }: { grades: Grades; now: Date }) {
  const { averagePoints, disciplinesPassed, disciplinesTotal, debts } = grades.summary;
  const note = debtsNote(debts, grades.pastDebts.length);
  return (
    <Card>
      <CardTitle as="h2">Как у меня дела</CardTitle>
      <div className="mt-3 flex flex-wrap items-end gap-x-2">
        <span className="text-4xl font-bold tracking-tight tabular-nums">
          {averagePoints.toLocaleString("ru-RU", { maximumFractionDigits: 1 })}
        </span>
        <span className="pb-1 text-sm text-muted-foreground">
          средний балл из {BRS_MAX.total} по текущим баллам
        </span>
      </div>
      <Bar value={averagePoints} max={BRS_MAX.total} className="mt-3" />
      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-md bg-muted px-3 py-2">
          <dt className="text-xs text-muted-foreground">Закрыто</dt>
          <dd className="font-semibold tabular-nums">
            {disciplinesPassed} из {disciplinesTotal}
          </dd>
        </div>
        <div className={cn("rounded-md px-3 py-2", debts ? "bg-danger-soft" : "bg-muted")}>
          <dt className="text-xs text-muted-foreground">Долги</dt>
          <dd
            className={cn(
              "flex items-center gap-1 font-semibold",
              debts ? "text-danger" : "text-success",
            )}
          >
            {debts ? (
              <CircleAlert aria-hidden className="size-4" />
            ) : (
              <CircleCheck aria-hidden className="size-4" />
            )}
            {debts || "Нет"}
          </dd>
          {note && <dd className="mt-0.5 text-xs text-muted-foreground">{note}</dd>}
        </div>
      </dl>
      {grades.session && (
        <div className="mt-4 border-t border-border pt-3">
          <SessionLine session={grades.session} now={now} />
        </div>
      )}
    </Card>
  );
}

function DisciplineCard({ d }: { d: DisciplineGrade }) {
  const result = resultLabel(d.result);
  const state = disciplineState(d);
  const Icon = state === "debt" ? CircleAlert : state === "pending" ? Clock : CircleCheck;
  return (
    <li>
      <Card className={cn("h-full", state === "debt" && "border-danger")}>
        <h3 className="font-semibold text-balance">{d.subject}</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {controlFormLabel(d.controlForm)} · {d.credits} з. е. · {d.teacher}
        </p>
        <p className="mt-1.5 flex items-start gap-1.5 text-sm">
          <CalendarClock aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span className={cn(!d.exam && "text-muted-foreground")}>{examLine(d)}</span>
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <Badge tone={result.tone}>
            <Icon aria-hidden />
            {result.label}
          </Badge>
          <span className="font-semibold tabular-nums">
            {d.totalPoints}{" "}
            <span className="font-normal text-muted-foreground">из {BRS_MAX.total}</span>
          </span>
        </div>
        <Bar value={d.totalPoints} max={BRS_MAX.total} danger={state === "debt"} className="mt-2" />
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Семестр</dt>
            <dd className="font-medium tabular-nums">
              {d.semesterPoints} из {BRS_MAX.semester}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{controlFormLabel(d.controlForm)}</dt>
            <dd className="font-medium tabular-nums">
              {d.examPoints === null ? "ещё не сдан" : `${d.examPoints} из ${BRS_MAX.exam}`}
            </dd>
          </div>
        </dl>
      </Card>
    </li>
  );
}

/** Успеваемость: сводка «как у меня дела» сверху, сроки сессии, дисциплины (долги первыми). */
export function GradesPage({ now = new Date() }: { now?: Date }) {
  const grades = useGrades();
  return (
    <>
      <PageHeader title="Успеваемость" description={grades.data?.semester} />
      {grades.isPending ? (
        <div role="status" aria-live="polite" className="flex flex-col gap-3">
          <span className="sr-only">Загружаем оценки…</span>
          <Skeleton className="h-52 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      ) : grades.isError ? (
        <ErrorState description={retryHint(grades.error)} onRetry={() => grades.refetch()} />
      ) : grades.data.disciplines.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="Оценок пока нет"
          description="Баллы появятся, когда преподаватели начнут их выставлять."
        />
      ) : (
        <div className="flex flex-col gap-6">
          <NextExamCard disciplines={grades.data.disciplines} now={now} />
          <Summary grades={grades.data} now={now} />
          <ForecastCard disciplines={grades.data.disciplines} pastDebts={grades.data.pastDebts} />
          <PastDebts debts={grades.data.pastDebts} />
          <section aria-labelledby="disciplines-title">
            <h2 id="disciplines-title" className="mb-3 text-lg font-semibold">
              Дисциплины
            </h2>
            <ul className="grid gap-3 lg:grid-cols-2">
              {sortForDisplay(grades.data.disciplines).map((d) => (
                <DisciplineCard key={d.id} d={d} />
              ))}
            </ul>
          </section>
        </div>
      )}
    </>
  );
}
