import { describe, expect, it } from "vitest";
import { ApiClientError, retryHint } from "./client";

describe("retryHint", () => {
  const server = "На сервере что-то пошло не так. Попробуйте чуть позже.";
  const reload = "Не получилось загрузить. Обновите страницу.";
  const network = "Проверьте интернет и попробуйте ещё раз.";

  it("нет связи и неизвестная ошибка — проверить интернет", () => {
    expect(retryHint(new ApiClientError(0, "network", "нет связи"))).toBe(network);
    expect(retryHint(new Error("что-то"))).toBe(network);
  });

  it("5xx и ответ не по контракту — сбой сервера", () => {
    expect(retryHint(new ApiClientError(500, "internal", "сбой"))).toBe(server);
    expect(retryHint(new ApiClientError(503, "unknown", "сбой"))).toBe(server);
    expect(retryHint(new ApiClientError(0, "bad_response", "формат"))).toBe(server);
  });

  it("4xx — не сбой сервера, а просьба обновить страницу", () => {
    expect(retryHint(new ApiClientError(400, "bad_request", "неверная неделя"))).toBe(reload);
    expect(retryHint(new ApiClientError(404, "not_found", "нет"))).toBe(reload);
    expect(retryHint(new ApiClientError(429, "rate_limited", "часто"))).toBe(reload);
  });
});
