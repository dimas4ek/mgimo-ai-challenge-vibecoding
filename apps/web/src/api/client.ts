import { ApiErrorSchema, buildPath, type PathParams, type RouteDef, routes } from "@aihs/contract";
import type { z } from "zod";

/**
 * Ошибка API в едином формате контракта (`{ error: { code, message } }`).
 * `status` — HTTP-код; `0` — сеть недоступна или ответ не по контракту.
 */
export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export const isApiError = (e: unknown, status?: number): e is ApiClientError =>
  e instanceof ApiClientError && (status === undefined || e.status === status);

/**
 * Что посоветовать после ошибки (#41). Нет связи — проверить интернет; 5xx или ответ не по контракту —
 * сбой сервера, попробовать позже; остальные 4xx — запрос не подошёл, обновить страницу.
 * Неизвестную ошибку считаем сетевой.
 */
export function retryHint(error: unknown): string {
  if (!isApiError(error) || error.code === "network")
    return "Проверьте интернет и попробуйте ещё раз.";
  if (error.status >= 500 || error.code === "bad_response") {
    return "На сервере что-то пошло не так. Попробуйте чуть позже.";
  }
  return "Не получилось загрузить. Обновите страницу.";
}

type Body<R extends RouteDef> = R["body"] extends z.ZodType ? z.input<R["body"]> : never;
type Query<R extends RouteDef> = R["query"] extends z.ZodType ? z.input<R["query"]> : never;
type Output<R extends RouteDef> = z.output<R["response"]>;

/** Аргументы вызова: только то, что этому роуту нужно (params, body, query). */
export type CallArgs<R extends RouteDef> = (PathParams<R["path"]> extends never
  ? { params?: never }
  : { params: Record<PathParams<R["path"]>, string> }) &
  (R["body"] extends z.ZodType ? { body: Body<R> } : { body?: never }) &
  (R["query"] extends z.ZodType ? { query?: Query<R> } : { query?: never }) & {
    signal?: AbortSignal;
  };

function toQueryString(query: Record<string, unknown> | undefined): string {
  if (!query) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query))
    if (v !== undefined && v !== null) sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/**
 * Вызов эндпоинта из `routes`. Тело и ответ валидируются схемами контракта:
 * расхождение фронта и API видно сразу, а не где-то в разметке.
 * Cookie сессии ходит сама (`credentials: "same-origin"`), токенов в JS нет.
 */
export async function call<R extends RouteDef>(route: R, args: CallArgs<R>): Promise<Output<R>> {
  const { params, body, query, signal } = args as {
    params?: Record<string, string>;
    body?: unknown;
    query?: Record<string, unknown>;
    signal?: AbortSignal;
  };
  const path =
    (buildPath as (p: string, v?: Record<string, string>) => string)(route.path, params) +
    toQueryString(query);
  // Абсолютный адрес от текущего origin: в браузере то же самое, а в тестах (jsdom + fetch из Node)
  // относительный URL не работает.
  const url = globalThis.location ? new URL(path, globalThis.location.href).toString() : path;
  const payload = route.body ? route.body.parse(body) : undefined;

  let res: Response;
  try {
    res = await fetch(url, {
      method: route.method,
      credentials: "same-origin",
      headers: payload === undefined ? undefined : { "content-type": "application/json" },
      body: payload === undefined ? undefined : JSON.stringify(payload),
      signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiClientError(0, "network", "Нет связи с сервером. Проверьте интернет.");
  }

  const json: unknown = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const err = ApiErrorSchema.safeParse(json);
    throw err.success
      ? new ApiClientError(res.status, err.data.error.code, err.data.error.message)
      : new ApiClientError(res.status, "unknown", "Что-то пошло не так. Попробуйте ещё раз.");
  }
  const parsed = route.response.safeParse(json);
  if (!parsed.success) {
    throw new ApiClientError(0, "bad_response", "Сервер ответил в неожиданном формате.");
  }
  return parsed.data as Output<R>;
}

/** Готовые вызовы по доменам — тонкая обёртка над `call`, чтобы хукам не собирать аргументы. */
export const api = {
  auth: {
    login: (body: Body<typeof routes.auth.login>) => call(routes.auth.login, { body }),
    logout: () => call(routes.auth.logout, {}),
    me: (signal?: AbortSignal) => call(routes.auth.me, { signal }),
  },
  me: {
    profile: (signal?: AbortSignal) => call(routes.me.profile, { signal }),
    schedule: (week?: string, signal?: AbortSignal) =>
      call(routes.me.schedule, { query: { week }, signal }),
    grades: (signal?: AbortSignal) => call(routes.me.grades, { signal }),
    demoReset: () => call(routes.me.demoReset, {}),
    requests: {
      list: (signal?: AbortSignal) => call(routes.me.requests.list, { signal }),
      get: (id: string, signal?: AbortSignal) =>
        call(routes.me.requests.get, { params: { id }, signal }),
      create: (body: Body<typeof routes.me.requests.create>) =>
        call(routes.me.requests.create, { body }),
    },
    notifications: {
      list: (signal?: AbortSignal) => call(routes.me.notifications.list, { signal }),
      markRead: (id: string) => call(routes.me.notifications.markRead, { params: { id } }),
    },
    certificates: {
      get: (requestId: string, signal?: AbortSignal) =>
        call(routes.me.certificates.get, { params: { requestId }, signal }),
    },
  },
  public: {
    certificates: {
      verify: (token: string, signal?: AbortSignal) =>
        call(routes.public.certificates.verify, { params: { token }, signal }),
    },
  },
  staff: {
    requests: {
      list: (query?: Query<typeof routes.staff.requests.list>, signal?: AbortSignal) =>
        call(routes.staff.requests.list, { query, signal }),
      changeStatus: (id: string, body: Body<typeof routes.staff.requests.changeStatus>) =>
        call(routes.staff.requests.changeStatus, { params: { id }, body }),
    },
  },
};
