import { BRS_MAX, type CurriculumDiscipline } from "@aihs/contract";
import { ArrowLeft, BookOpen, ChevronRight } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router";
import { retryHint } from "../../api";
import { useCurriculum } from "../../api/hooks";
import { paths } from "../../app/paths";
import { Badge, Card, EmptyState, ErrorState, Skeleton } from "../../ui";
import { controlFormLabel, examLine, resultLabel } from "./model";

export function CurriculumPanel({
  semesterId,
  subjectId,
}: {
  semesterId: string | null;
  subjectId: string | null;
}) {
  const query = useCurriculum();
  const navigate = useNavigate();
  if (query.isPending) {
    return (
      <div role="status" className="space-y-3">
        <span className="sr-only">Загружаем учебный план…</span>
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-36 w-full" />
      </div>
    );
  }
  if (query.isError) {
    return <ErrorState description={retryHint(query.error)} onRetry={() => query.refetch()} />;
  }
  const { semesters, currentSemesterId } = query.data;
  const semester =
    semesters.find((entry) => entry.id === semesterId) ??
    (!semesterId && subjectId
      ? semesters.find((entry) => entry.disciplines.some((d) => d.subjectId === subjectId))
      : undefined) ??
    semesters.find((entry) => entry.id === currentSemesterId) ??
    semesters[0];
  if (!semester) {
    return (
      <EmptyState
        icon={BookOpen}
        title="Учебный план пока пуст"
        description="Дисциплины появятся, когда деканат добавит учебный план вашей группы."
      />
    );
  }

  const discipline = semester.disciplines.find((entry) => entry.subjectId === subjectId);
  const listPath = paths.curriculum({ semester: semester.id });
  if (subjectId) {
    return (
      <div className="space-y-3">
        <Link
          to={listPath}
          className="inline-flex min-h-11 items-center gap-2 rounded-sm text-primary"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Все дисциплины
        </Link>
        {discipline ? (
          <DisciplineDetails
            key={discipline.subjectId}
            discipline={discipline}
            semester={semester.name}
          />
        ) : (
          <EmptyState
            icon={BookOpen}
            title="Дисциплина не найдена"
            description="Посмотрите список дисциплин вашей группы."
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <label className="block max-w-sm space-y-1 text-sm font-medium">
        <span>Семестр</span>
        <select
          className="block min-h-11 w-full rounded-md border border-border bg-surface px-3"
          value={semester.id}
          onChange={(e) => navigate(paths.curriculum({ semester: e.currentTarget.value }))}
        >
          {semesters.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>
      </label>
      <ul aria-label="Дисциплины семестра" className="grid gap-3 lg:grid-cols-2">
        {semester.disciplines.map((entry) => (
          <li key={entry.subjectId}>
            <Link
              to={paths.curriculum({ semester: semester.id, subject: entry.subjectId })}
              className="flex h-full min-h-11 items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 shadow-card hover:border-primary"
            >
              <div className="min-w-0">
                <p className="font-semibold">{entry.subject}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {controlFormLabel(entry.controlForm)} · {entry.credits} з. е.
                </p>
                {entry.grade && (
                  <p className="mt-1 text-sm">
                    {entry.grade.totalPoints} из {BRS_MAX.total} баллов ·{" "}
                    {resultLabel(entry.grade.result).label}
                  </p>
                )}
              </div>
              <ChevronRight aria-hidden className="size-4 shrink-0 text-primary" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DisciplineDetails({
  discipline,
  semester,
}: {
  discipline: CurriculumDiscipline;
  semester: string;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const { grade, hours, controlForm, credits } = discipline;
  const result = grade && resultLabel(grade.result);
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card>
        <p className="text-sm text-muted-foreground">{semester}</p>
        <h2 ref={heading} tabIndex={-1} className="mt-1 text-xl font-semibold">
          {discipline.subject}
        </h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div>
            <dt className="text-muted-foreground">Преподаватель</dt>
            <dd>{discipline.teacher}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Форма контроля</dt>
            <dd>{controlFormLabel(controlForm)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Зачётные единицы</dt>
            <dd>{credits}</dd>
          </div>
        </dl>
      </Card>
      <Card>
        <h3 className="font-semibold">Учебная нагрузка</h3>
        <p className="text-sm text-muted-foreground">В академических часах</p>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-2">
            <dt>Лекции</dt>
            <dd>{hours.lectures}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Семинары и практика</dt>
            <dd>{hours.practice}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Самостоятельная работа</dt>
            <dd>{hours.independent}</dd>
          </div>
          <div className="flex justify-between gap-2 border-t border-border pt-2 font-semibold">
            <dt>Всего часов</dt>
            <dd>{hours.lectures + hours.practice + hours.independent}</dd>
          </div>
        </dl>
      </Card>
      <Card>
        <h3 className="font-semibold">Оценки</h3>
        {grade && result ? (
          <>
            <p className="mt-2 text-sm">{examLine({ controlForm, exam: grade.exam })}</p>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt>Баллы за семестр</dt>
                <dd>
                  {grade.semesterPoints} из {BRS_MAX.semester}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Баллы за контроль</dt>
                <dd>
                  {grade.examPoints === null
                    ? "Пока нет"
                    : `${grade.examPoints} из ${BRS_MAX.exam}`}
                </dd>
              </div>
              <div className="flex justify-between gap-2 font-semibold">
                <dt>Итоговый балл</dt>
                <dd>
                  {grade.totalPoints} из {BRS_MAX.total}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt>Итог</dt>
                <dd>
                  <Badge tone={result.tone}>{result.label}</Badge>
                </dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Баллы пока не выставлены.</p>
        )}
      </Card>
    </div>
  );
}
