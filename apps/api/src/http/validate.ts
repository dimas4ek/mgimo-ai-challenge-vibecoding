import { validator } from "hono/validator";
import type { z } from "zod";
import { apiError } from "./errors";

/**
 * Валидация входа схемой из `@aihs/contract`. Невалидный вход → 400 в формате `ApiError`
 * (code `validation`). Данные потом берутся через `c.req.valid(target)`.
 *
 * `app.post(path, validate("json", LoginInputSchema), (c) => { const body = c.req.valid("json") })`
 */
export function validate<T extends z.ZodType, Target extends "json" | "query" | "param">(
  target: Target,
  schema: T,
) {
  return validator(target, (value, c) => {
    const result = schema.safeParse(value);
    if (!result.success) {
      return apiError(c, 400, "validation", "Проверьте введённые данные");
    }
    return result.data as z.output<T>;
  });
}
