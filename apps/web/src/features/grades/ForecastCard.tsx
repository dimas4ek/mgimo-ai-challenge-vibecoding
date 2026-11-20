import type { DisciplineGrade, PastDebt } from "@aihs/contract";
import { CircleAlert, CircleCheck, RotateCcw, Target } from "lucide-react";
import { useState } from "react";
import { cn } from "../../lib/cn";
import { Badge, Card, CardTitle } from "../../ui";
import { type DisciplineNeed, type ForecastGoal, forecast, GOALS } from "./forecast";

const PREFERENCE: ForecastGoal[] = ["increased", "scholarship", "close"];

/** Почему цель по дисциплине недостижима — словами, а не только красным. */
function impossibleReason(d: DisciplineGrade | undefined): string {
  if (d?.result === "unsatisfactory" || d?.result === "failed") return "Долг: нужна пересдача";
  if (d && d.result !== "pending") return "Итог уже ниже";
  return "Не хватит и 40";
}

function NeedBadge({ need, discipline }: { need: DisciplineNeed; discipline?: DisciplineGrade }) {
  switch (need.kind) {
    case "done":
      return (
        <Badge tone="success">
          <CircleCheck aria-hidden />
          Уже есть
        </Badge>
      );
    case "need":
      return <Badge tone="primary">от {need.examPoints} из 40</Badge>;
    case "retake":
      return (
        <Badge tone="warning">
          <RotateCcw aria-hidden />
          Пересдача: от {need.examPoints} из 40
        </Badge>
      );
    case "impossible":
      return (
        <Badge tone="danger">
          <CircleAlert aria-hidden />
          {impossibleReason(discipline)}
        </Badge>
      );
  }
}

/**
 * Калькулятор «что нужно набрать» (#24): цель на выбор, итог простыми словами и по каждой
 * дисциплине — сколько баллов нужно на экзамене или зачёте. Правило цели показано под выбором.
 * Долги прошлых сессий (#37) — отдельные строки «Пересдать: …» в цели «Закрыть сессию».
 */
export function ForecastCard({
  disciplines,
  pastDebts = [],
}: {
  disciplines: readonly DisciplineGrade[];
  pastDebts?: readonly PastDebt[];
}) {
  const all = forecast(disciplines, pastDebts);
  const byId = new Map<string, DisciplineGrade>(
    [...disciplines, ...pastDebts].map((d) => [d.id, d]),
  );
  // По умолчанию — самая амбициозная цель, которая ещё достижима.
  const fallback = PREFERENCE.find((g) => all.find((f) => f.goal === g)?.reachable) ?? "close";
  const [goal, setGoal] = useState<ForecastGoal>(fallback);
  const current = all.find((f) => f.goal === goal) ?? all[0];
  if (!current) return null;
  const pending = current.items.filter((i) => i.need.kind !== "done");
  const doneCount = current.items.length - pending.length;

  return (
    <Card>
      <CardTitle as="h2" className="flex items-center gap-2">
        <Target aria-hidden className="size-5 text-primary" />
        Что нужно набрать
      </CardTitle>
      <fieldset className="mt-3">
        <legend className="sr-only">Цель</legend>
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
          {all.map((f) => (
            <button
              key={f.goal}
              type="button"
              aria-pressed={f.goal === goal}
              onClick={() => setGoal(f.goal)}
              className={cn(
                "min-h-11 rounded-md px-1 text-xs leading-tight font-semibold transition-colors sm:text-sm",
                f.goal === goal
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {GOALS[f.goal].title}
            </button>
          ))}
        </div>
      </fieldset>
      <p className="mt-2 text-sm text-muted-foreground">{GOALS[goal].rule}</p>

      <p
        role="status"
        className={cn(
          "mt-4 flex items-start gap-2 rounded-md px-3 py-2 text-sm font-medium",
          current.reachable ? "bg-success-soft text-success" : "bg-danger-soft text-danger",
        )}
      >
        {current.reachable ? (
          <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
        ) : (
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
        )}
        {!current.reachable
          ? "В эту сессию уже не получится — см. дисциплины ниже."
          : current.remaining === 0
            ? "Уже выполнено, так держать!"
            : `Достижимо: баллы нужны ещё по ${current.remaining} ${
                current.remaining === 1 ? "дисциплине" : "дисциплинам"
              } из ${current.items.length}.`}
      </p>

      {pending.length > 0 && (
        <ul className="mt-3 divide-y divide-border">
          {pending.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <span className="min-w-0 text-sm font-medium">
                {i.semester ? `Пересдать: ${i.subject}, ${i.semester.toLowerCase()}` : i.subject}
              </span>
              <NeedBadge need={i.need} discipline={byId.get(i.id)} />
            </li>
          ))}
        </ul>
      )}
      {doneCount > 0 && (
        <p className="mt-2 text-sm text-muted-foreground">
          Уже выполнено по {doneCount} из {current.items.length}.
        </p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        По вымышленному «Положению о стипендиях AI High School». Итог = баллы за семестр (до 60) +
        экзамен или зачёт (до 40).
      </p>
    </Card>
  );
}
