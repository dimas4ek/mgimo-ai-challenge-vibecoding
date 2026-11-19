import { z } from "zod";

/** id ресурса: всегда UUID, никогда автоинкремент (`.claude/rules/security.md`). */
export const IdSchema = z.uuid();
export type Id = z.infer<typeof IdSchema>;

/** Дата без времени, `YYYY-MM-DD` (календарь Europe/Moscow). */
export const IsoDateSchema = z.iso.date();

/** Момент времени, ISO 8601 с зоной, например `2026-11-19T09:30:00.000Z`. */
export const IsoDateTimeSchema = z.iso.datetime({ offset: true });

/** Время пары по Москве, `HH:MM` (00:00–23:59). */
export const TimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "ожидается HH:MM");

/** Единый формат ошибки API: `{ error: { code, message } }`. */
export const ApiErrorSchema = z.object({
  error: z.object({
    /** Машинный код: `unauthorized`, `forbidden`, `not_found`, `validation`, `rate_limited`, `internal`. */
    code: z.string(),
    /** Текст для человека, на русском. */
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

/** Ответ без данных для действий вроде logout. */
export const OkSchema = z.object({ ok: z.literal(true) });
export type Ok = z.infer<typeof OkSchema>;
