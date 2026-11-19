import type { Lesson } from "@aihs/contract";

type LessonCardProps = {
  lesson: Lesson;
  /** Пара идёт сейчас: карточка выделена и подписана «Идёт сейчас». */
  ongoing?: boolean;
  /** Показать дату (для «ближайшей пары» из другого дня). */
  showDate?: boolean;
};

/**
 * Карточка пары: время, предмет, тип, аудитория, преподаватель. Перенос, замена и отмена видны
 * бейджем с иконкой и текстом и пояснением деканата, а не только цветом. Отменённая пара зачёркнута.
 * Используется на экране расписания (#14) и на главной (#21).
 */
export function LessonCard(_props: LessonCardProps) {
  throw new Error("not implemented");
}
