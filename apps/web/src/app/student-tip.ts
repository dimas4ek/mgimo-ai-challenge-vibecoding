/** Подсказка в кабинете студента. Действие ведёт на страницу внутри кабинета. */
export interface StudentTip {
  title: string;
  text: string;
  action?: { label: string; to: string };
}
