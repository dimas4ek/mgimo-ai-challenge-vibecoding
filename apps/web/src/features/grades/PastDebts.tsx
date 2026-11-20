import { BRS_MAX, type PastDebt } from "@aihs/contract";
import { CircleAlert, RotateCcw } from "lucide-react";
import { Link } from "react-router";
import { paths } from "../../app/paths";
import { Badge, buttonVariants, Card } from "../../ui";
import { controlFormLabel, resultLabel } from "./model";

/** Адрес мастера заявки с уже выбранной пересдачей. */
export const retakeLink = `${paths.requests}?new=1&type=retake_application`;

/**
 * Долги прошлых сессий (#34): над дисциплинами текущего семестра. Долгов нет — блока нет.
 * У каждого долга — семестр, баллы, итог текстом с иконкой и кнопка «Подать на пересдачу».
 */
export function PastDebts({ debts }: { debts: readonly PastDebt[] }) {
  if (debts.length === 0) return null;
  return (
    <section aria-labelledby="past-debts-title">
      <h2
        id="past-debts-title"
        className="mb-3 flex items-center gap-2 text-lg font-semibold text-danger"
      >
        <CircleAlert aria-hidden className="size-5" />
        Долги прошлых сессий
      </h2>
      <ul className="grid gap-3 lg:grid-cols-2">
        {debts.map((d) => {
          const result = resultLabel(d.result);
          return (
            <li key={d.id}>
              <Card className="h-full border-danger">
                <p className="text-sm text-muted-foreground">{d.semester}</p>
                <h3 className="mt-0.5 font-semibold text-balance">{d.subject}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {controlFormLabel(d.controlForm)} · {d.credits} з. е. · {d.teacher}
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <Badge tone={result.tone}>
                    <CircleAlert aria-hidden />
                    {result.label}
                  </Badge>
                  <span className="font-semibold tabular-nums">
                    {d.totalPoints}{" "}
                    <span className="font-normal text-muted-foreground">из {BRS_MAX.total}</span>
                  </span>
                </div>
                <Link
                  to={retakeLink}
                  className={buttonVariants({ variant: "outline", block: true, className: "mt-4" })}
                >
                  <RotateCcw aria-hidden />
                  Подать на пересдачу
                </Link>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
