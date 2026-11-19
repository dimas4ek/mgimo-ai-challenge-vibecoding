import type { ApiError } from "@aihs/contract";
import type { Context, ErrorHandler, NotFoundHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";

/** Ответ об ошибке в едином формате `ApiError`. */
export function apiError(c: Context, status: ContentfulStatusCode, code: string, message: string) {
  return c.json({ error: { code, message } } satisfies ApiError, status);
}

/** 404 для неизвестных путей, в формате `ApiError`. */
export const notFoundHandler: NotFoundHandler = (c) => apiError(c, 404, "not_found", "Не найдено");

/** Общий обработчик: стек наружу не уходит, в лог — уходит. */
export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof HTTPException) {
    return apiError(c, err.status as ContentfulStatusCode, "http_error", err.message);
  }
  console.error(err);
  return apiError(c, 500, "internal", "Что-то пошло не так. Попробуйте ещё раз");
};
