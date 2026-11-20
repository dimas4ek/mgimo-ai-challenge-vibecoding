import { BRS_MAX, type CertificateGrade } from "@aihs/contract";
import { controlFormLabel, resultLabel } from "../grades/model";
import { groupBySemester } from "./model";

/**
 * Таблица оценок в выписке (#32): снимок на дату выдачи, по семестрам. На телефоне — строки-карточки
 * (без горизонтального скролла), на широком экране и при печати — таблица. Строка не рвётся
 * между страницами, шапка таблицы повторяется на каждой странице (стандартное поведение thead).
 */
export function GradesTable({ grades }: { grades: readonly CertificateGrade[] }) {
  const groups = groupBySemester(grades);
  return (
    <section aria-labelledby="certificate-grades" className="mt-8">
      <h2 id="certificate-grades" className="text-lg font-semibold">
        Оценки на дату выдачи
      </h2>
      {groups.map((group) => (
        <div key={group.semester} className="mt-4 break-inside-avoid-page">
          <h3 className="text-sm font-semibold text-muted-foreground">{group.semester}</h3>

          {/* Телефон: карточки. */}
          <ul className="mt-2 flex flex-col divide-y divide-border sm:hidden print:hidden">
            {group.items.map((g) => (
              <li key={g.subject} className="py-2.5">
                <p className="font-medium break-words">{g.subject}</p>
                <p className="mt-0.5 flex flex-wrap justify-between gap-x-3 text-sm text-muted-foreground">
                  <span>
                    {controlFormLabel(g.controlForm)} · {g.credits} з. е.
                  </span>
                  <span className="text-foreground">
                    {g.totalPoints} из {BRS_MAX.total} · {resultLabel(g.result).label}
                  </span>
                </p>
              </li>
            ))}
          </ul>

          {/* Широкий экран и печать: таблица. */}
          <table className="mt-2 hidden w-full border-collapse text-sm sm:table print:table">
            <caption className="sr-only">Оценки: {group.semester}</caption>
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th scope="col" className="py-2 pr-3 font-medium">
                  Дисциплина
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Форма контроля
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  З. е.
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  Балл
                </th>
                <th scope="col" className="py-2 font-medium">
                  Результат
                </th>
              </tr>
            </thead>
            <tbody>
              {group.items.map((g) => (
                <tr key={g.subject} className="break-inside-avoid border-b border-border">
                  <td className="py-2 pr-3 font-medium">{g.subject}</td>
                  <td className="py-2 pr-3">{controlFormLabel(g.controlForm)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{g.credits}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{g.totalPoints}</td>
                  <td className="py-2">{resultLabel(g.result).label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}
