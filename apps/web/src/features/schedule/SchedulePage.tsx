import type { Lesson, WeekSchedule } from "@aihs/contract";
import { CalendarCheck, CalendarX, ChevronLeft, ChevronRight } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { retryHint, useProfile, useSchedule } from "../../api";
import { paths } from "../../app/paths";
import {
  Badge,
  Button,
  buttonVariants,
  EmptyState,
  ErrorState,
  ListSkeleton,
  PageHeader,
  Tabs,
} from "../../ui";
import { LessonCard } from "./LessonCard";
import {
  addDays,
  formatDayTitle,
  formatWeekRange,
  groupByDay,
  type IsoDate,
  isOngoing,
  lessonsOn,
  mondayOf,
  moscowToday,
  nextLesson,
  parseScheduleWeek,
  scheduleWeekQueryDate,
} from "./model";

const PERIOD_TABS = [
  { value: "today", label: "Сегодня" },
  { value: "week", label: "Неделя" },
] as const;
type View = (typeof PERIOD_TABS)[number]["value"];

/** «Сейчас», обновляется раз в минуту: подсветка «Идёт сейчас» не залипает. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/**
 * Расписание: вкладки «Сегодня» и «Неделя». Состояние в адресе (`?view=week&week=2026-11-16`),
 * поэтому ссылка из уведомления о переносе (`/schedule?week=…`) открывает нужную неделю.
 */
export function SchedulePage() {
  const { data: profile } = useProfile();
  const [params, setParams] = useSearchParams();
  const now = useNow();
  const today = moscowToday(now);
  const weekParam = params.get("week");
  const weekDate = parseScheduleWeek(weekParam);
  const invalidWeek = weekParam !== null && weekDate === null;
  const week = mondayOf(weekDate ?? today);
  const view: View =
    invalidWeek || (params.get("view") ?? (weekDate ? "week" : "today")) === "week"
      ? "week"
      : "today";

  useEffect(() => {
    if (!invalidWeek) return;
    const next = new URLSearchParams(params);
    next.delete("week");
    next.set("view", "week");
    setParams(next, { replace: true });
  }, [invalidWeek, params, setParams]);

  const update = (change: (p: URLSearchParams) => void) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        change(p);
        return p;
      },
      { replace: true },
    );

  const show = (next: View) =>
    update((p) => {
      p.set("view", next);
      if (next === "today") p.delete("week");
    });

  const showWeek = (date: IsoDate) =>
    update((p) => {
      p.set("view", "week");
      if (mondayOf(date) === mondayOf(today)) p.delete("week");
      else p.set("week", date);
    });

  return (
    <>
      <PageHeader
        title="Расписание"
        description={formatDayTitle(today)}
        actions={
          profile && (
            <Link className={buttonVariants({ variant: "outline" })} to={paths.group}>
              Группа {profile.group}
            </Link>
          )
        }
      />
      <Tabs id="schedule" label="Период" tabs={PERIOD_TABS} value={view} onChange={show}>
        {view === "today" ? (
          <TodayView today={today} now={now} onShowWeek={() => show("week")} />
        ) : (
          <WeekView week={week} today={today} now={now} onWeek={showWeek} />
        )}
      </Tabs>
    </>
  );
}

/** Загрузка (скелетон), ошибка («Повторить») или данные недели. `week` не задан — текущая неделя. */
function WeekQuery({
  week,
  children,
}: {
  week: IsoDate | undefined;
  children: (schedule: WeekSchedule) => ReactNode;
}) {
  const query = useSchedule(week);
  if (query.isPending) return <ListSkeleton rows={3} label="Загружаем расписание…" />;
  if (query.isError)
    return <ErrorState description={retryHint(query.error)} onRetry={() => query.refetch()} />;
  return <>{children(query.data)}</>;
}

function LessonList({ lessons, now }: { lessons: Lesson[]; now: Date }) {
  return (
    <ul className="flex flex-col gap-3">
      {lessons.map((lesson) => (
        <li key={lesson.id}>
          <LessonCard lesson={lesson} ongoing={isOngoing(lesson, now)} />
        </li>
      ))}
    </ul>
  );
}

function TodayView({
  today,
  now,
  onShowWeek,
}: {
  today: IsoDate;
  now: Date;
  onShowWeek: () => void;
}) {
  return (
    <WeekQuery week={undefined}>
      {(schedule) => {
        const lessons = lessonsOn(schedule.lessons, today);
        if (lessons.length > 0) return <LessonList lessons={lessons} now={now} />;
        const next = nextLesson(schedule.lessons, now);
        return (
          <div className="flex flex-col gap-4">
            <EmptyState
              icon={CalendarCheck}
              title="Сегодня пар нет"
              description="Можно отдохнуть или заняться курсовой."
              action={
                <Button variant="outline" onClick={onShowWeek}>
                  Расписание на неделю
                </Button>
              }
            />
            {next ? (
              <NextLesson lesson={next} />
            ) : (
              // На этой неделе больше пар нет — ищем первую пару следующей.
              <WeekQuery week={addDays(mondayOf(today), 7)}>
                {(nextWeek) => {
                  const first = nextLesson(nextWeek.lessons, now);
                  return first ? <NextLesson lesson={first} /> : null;
                }}
              </WeekQuery>
            )}
          </div>
        );
      }}
    </WeekQuery>
  );
}

function NextLesson({ lesson }: { lesson: Lesson }) {
  return (
    <section aria-labelledby="next-lesson-title" className="flex flex-col gap-2">
      <h2 id="next-lesson-title" className="text-sm font-semibold text-muted-foreground">
        Ближайшая пара
      </h2>
      <LessonCard lesson={lesson} showDate />
    </section>
  );
}

function WeekView({
  week,
  today,
  now,
  onWeek,
}: {
  week: IsoDate;
  today: IsoDate;
  now: Date;
  onWeek: (date: IsoDate) => void;
}) {
  const isCurrent = week === mondayOf(today);
  const previous = scheduleWeekQueryDate(addDays(week, -7));
  const next = scheduleWeekQueryDate(addDays(week, 7));
  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Недели" className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Предыдущая неделя"
          disabled={previous === null}
          onClick={() => previous && onWeek(previous)}
        >
          <ChevronLeft />
        </Button>
        <div className="flex min-w-0 flex-col items-center text-center">
          <p className="font-semibold">{formatWeekRange(week, addDays(week, 6))}</p>
          {isCurrent ? (
            <span className="text-xs text-muted-foreground">Текущая неделя</span>
          ) : (
            <button
              type="button"
              onClick={() => onWeek(mondayOf(today))}
              className="min-h-11 cursor-pointer px-2 text-xs font-semibold text-primary underline-offset-2 hover:underline"
            >
              К текущей неделе
            </button>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Следующая неделя"
          disabled={next === null}
          onClick={() => next && onWeek(next)}
        >
          <ChevronRight />
        </Button>
      </nav>
      <WeekQuery week={isCurrent ? undefined : (scheduleWeekQueryDate(week) ?? undefined)}>
        {(schedule) => {
          const days = groupByDay(schedule.lessons);
          if (days.length === 0) {
            return (
              <EmptyState
                icon={CalendarX}
                title="На этой неделе пар нет"
                description="Каникулы или сессия. Загляните на соседнюю неделю."
              />
            );
          }
          return (
            <div className="flex flex-col gap-6">
              {days.map((day) => (
                <section key={day.date} aria-labelledby={`day-${day.date}`}>
                  <h2
                    id={`day-${day.date}`}
                    className="mb-2 flex items-center gap-2 text-sm font-semibold"
                  >
                    {formatDayTitle(day.date)}
                    {day.date === today && <Badge tone="primary">Сегодня</Badge>}
                  </h2>
                  <LessonList lessons={day.lessons} now={now} />
                </section>
              ))}
            </div>
          );
        }}
      </WeekQuery>
    </div>
  );
}
