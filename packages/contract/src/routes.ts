import { z } from "zod";
import { LoginInputSchema, MeSchema } from "./auth";
import { CertificateSchema, CertificateVerificationSchema } from "./certificates";
import { OkSchema } from "./common";
import { GradesSchema } from "./grades";
import { HealthSchema } from "./health";
import { NotificationListSchema, NotificationSchema } from "./notifications";
import { ProfileSchema } from "./profile";
import { CreateRequestInputSchema, RequestListItemSchema, RequestSchema } from "./requests";
import { ScheduleQuerySchema, WeekScheduleSchema } from "./schedule";
import { ChangeStatusInputSchema, StaffRequestItemSchema, StaffRequestsQuerySchema } from "./staff";

export type HttpMethod = "GET" | "POST";

/**
 * Описание эндпоинта. `path` с параметрами в стиле Hono (`/api/me/requests/:id`).
 * `body` — схема тела запроса, `query` — схема query-строки, `response` — схема успешного ответа.
 * Ошибки всегда в форме `ApiErrorSchema`.
 */
export interface RouteDef {
  method: HttpMethod;
  path: string;
  body?: z.ZodType;
  query?: z.ZodType;
  response: z.ZodType;
}

/** Все роуты API. Сервер и клиент берут пути и схемы только отсюда. */
export const routes = {
  health: { method: "GET", path: "/api/health", response: HealthSchema },

  auth: {
    login: { method: "POST", path: "/api/auth/login", body: LoginInputSchema, response: MeSchema },
    logout: { method: "POST", path: "/api/auth/logout", response: OkSchema },
    me: { method: "GET", path: "/api/auth/me", response: MeSchema },
  },

  me: {
    profile: { method: "GET", path: "/api/me/profile", response: ProfileSchema },
    schedule: {
      method: "GET",
      path: "/api/me/schedule",
      query: ScheduleQuerySchema,
      response: WeekScheduleSchema,
    },
    grades: { method: "GET", path: "/api/me/grades", response: GradesSchema },
    /** Сброс демо-данных своего аккаунта (заявки, уведомления) к исходному сиду: для жюри на общих аккаунтах. */
    demoReset: { method: "POST", path: "/api/me/demo-reset", response: OkSchema },
    requests: {
      list: { method: "GET", path: "/api/me/requests", response: z.array(RequestListItemSchema) },
      create: {
        method: "POST",
        path: "/api/me/requests",
        body: CreateRequestInputSchema,
        response: RequestSchema,
      },
      get: { method: "GET", path: "/api/me/requests/:id", response: RequestSchema },
    },
    notifications: {
      list: { method: "GET", path: "/api/me/notifications", response: NotificationListSchema },
      markRead: {
        method: "POST",
        path: "/api/me/notifications/:id/read",
        response: NotificationSchema,
      },
    },
    certificates: {
      get: {
        method: "GET",
        path: "/api/me/certificates/:requestId",
        response: CertificateSchema,
      },
    },
  },

  staff: {
    requests: {
      list: {
        method: "GET",
        path: "/api/staff/requests",
        query: StaffRequestsQuerySchema,
        response: z.array(StaffRequestItemSchema),
      },
      changeStatus: {
        method: "POST",
        path: "/api/staff/requests/:id/status",
        body: ChangeStatusInputSchema,
        response: StaffRequestItemSchema,
      },
    },
  },

  /** Без входа. Отдаёт только то, что можно показать любому, кто отсканировал QR. */
  public: {
    certificates: {
      verify: {
        method: "GET",
        path: "/api/public/certificates/:token",
        response: CertificateVerificationSchema,
      },
    },
  },
} as const satisfies Record<string, unknown>;

/** Имена параметров пути: `"/api/me/requests/:id"` → `"id"`. */
export type PathParams<P extends string> = P extends `${string}:${infer Name}/${infer Rest}`
  ? Name | PathParams<`/${Rest}`>
  : P extends `${string}:${infer Name}`
    ? Name
    : never;

/**
 * Подставляет параметры в путь: `buildPath("/api/me/requests/:id", { id })`.
 * Значения кодируются через `encodeURIComponent`.
 */
export function buildPath<P extends string>(
  path: P,
  ...params: PathParams<P> extends never ? [] : [Record<PathParams<P>, string>]
): string {
  const values = (params[0] ?? {}) as Record<string, string>;
  return path.replace(/:([A-Za-z_]\w*)/g, (_, name: string) => {
    const value = values[name];
    if (value === undefined) throw new Error(`buildPath: нет параметра "${name}" для ${path}`);
    return encodeURIComponent(value);
  });
}
