import type {
  ChangeStatusInput,
  CreateRequestInput,
  LoginInput,
  Me,
  StaffRequestsQuery,
} from "@aihs/contract";
import {
  QueryClient,
  type QueryKey,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { clearApiCache } from "../app/pwa";
import { api, isApiError } from "./client";

/** Ключи кэша. Инвалидацию делаем только через них. */
export const queryKeys = {
  me: ["me"] as const,
  profile: ["profile"] as const,
  schedule: (week?: string) => ["schedule", week ?? "current"] as const,
  grades: ["grades"] as const,
  requests: ["requests"] as const,
  request: (id: string) => ["requests", id] as const,
  notifications: ["notifications"] as const,
  staffRequests: (query?: StaffRequestsQuery) => ["staff", "requests", query ?? {}] as const,
  staffAll: ["staff"] as const,
} satisfies Record<string, QueryKey | ((...a: never[]) => QueryKey)>;

/** Клиент TanStack Query с настройками приложения. 4xx не повторяем — это не сбой сети. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        retry: (count, error) =>
          !(isApiError(error) && error.status >= 400 && error.status < 500) && count < 2,
      },
      mutations: { retry: false },
    },
  });
}

// ── auth ────────────────────────────────────────────────────────────────

/** Текущий пользователь. `null` — не вошёл (401), это не ошибка. */
export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: async ({ signal }): Promise<Me | null> => {
      try {
        return await api.auth.me(signal);
      } catch (e) {
        if (isApiError(e, 401)) {
          // Сессия кончилась без «Выйти» — офлайн-кэш прошлой сессии на устройстве не нужен.
          await clearApiCache();
          return null;
        }
        throw e;
      }
    },
    staleTime: 5 * 60_000,
  });
}

/** Вход. При успехе кладёт пользователя в кэш `useMe`. Ошибка 401 — «неверный логин или пароль». */
export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => api.auth.login(input),
    onSuccess: (me) => {
      qc.clear();
      qc.setQueryData(queryKeys.me, me);
    },
  });
}

/** Выход: сессия удаляется на сервере, кэш с чужими данными очищается целиком. */
export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.auth.logout(),
    onSettled: async () => {
      qc.clear();
      qc.setQueryData(queryKeys.me, null);
      // Офлайн-кэш service worker (расписание, `me`) тоже чистим: устройство может быть общим.
      await clearApiCache();
    },
  });
}

// ── студент ─────────────────────────────────────────────────────────────

export function useProfile() {
  return useQuery({ queryKey: queryKeys.profile, queryFn: ({ signal }) => api.me.profile(signal) });
}

/** Неделя расписания. `week` — любая дата недели `YYYY-MM-DD`; без неё — текущая неделя по МСК. */
export function useSchedule(week?: string) {
  return useQuery({
    queryKey: queryKeys.schedule(week),
    queryFn: ({ signal }) => api.me.schedule(week, signal),
  });
}

export function useGrades() {
  return useQuery({ queryKey: queryKeys.grades, queryFn: ({ signal }) => api.me.grades(signal) });
}

export function useRequests() {
  return useQuery({
    queryKey: queryKeys.requests,
    queryFn: ({ signal }) => api.me.requests.list(signal),
  });
}

/** Карточка заявки. Чужая или несуществующая — ошибка 404 (`isApiError(error, 404)`). */
export function useRequest(id: string) {
  return useQuery({
    queryKey: queryKeys.request(id),
    queryFn: ({ signal }) => api.me.requests.get(id, signal),
    enabled: id !== "",
  });
}

export function useCreateRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRequestInput) => api.me.requests.create(input),
    onSuccess: (created) => {
      qc.setQueryData(queryKeys.request(created.id), created);
      return qc.invalidateQueries({ queryKey: queryKeys.requests });
    },
  });
}

/**
 * Лента уведомлений. Обновляется раз в минуту, чтобы новый статус заявки приходил сам.
 * `enabled: false` — не запрашивать (каркас у сотрудника: эндпоинт только для студента).
 */
export function useNotifications(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: ({ signal }) => api.me.notifications.list(signal),
    refetchInterval: 60_000,
    enabled: options?.enabled ?? true,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.me.notifications.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
}

// ── сотрудник ───────────────────────────────────────────────────────────

/** Очередь заявок всех студентов (роль staff). `status` — фильтр. */
export function useStaffRequests(query?: StaffRequestsQuery) {
  return useQuery({
    queryKey: queryKeys.staffRequests(query),
    queryFn: ({ signal }) => api.staff.requests.list(query, signal),
  });
}

export function useChangeRequestStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: ChangeStatusInput & { id: string }) =>
      api.staff.requests.changeStatus(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.staffAll }),
  });
}
