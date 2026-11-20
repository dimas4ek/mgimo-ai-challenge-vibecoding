/**
 * Порядковый номер семестра по названию «Осенний семестр 2026/27»: учебный год, внутри него
 * осенний раньше весеннего. Отдельной даты начала у семестра в БД нет.
 */
export function semesterOrder(name: string): number {
  const year = Number(/(\d{4})\/\d{2}/.exec(name)?.[1] ?? 0);
  return year * 2 + (name.startsWith("Весенний") ? 1 : 0);
}
