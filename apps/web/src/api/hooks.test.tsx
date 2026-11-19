// @vitest-environment jsdom
import { fixtures } from "@aihs/contract";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import type { ReactNode } from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { handlers, resetMockDb } from "../mocks/handlers";
import { isApiError } from "./client";
import {
  createQueryClient,
  useChangeRequestStatus,
  useCreateRequest,
  useGrades,
  useLogin,
  useLogout,
  useMarkRead,
  useMe,
  useNotifications,
  useProfile,
  useRequest,
  useRequests,
  useSchedule,
  useStaffRequests,
} from "./hooks";

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
beforeEach(() => resetMockDb({ as: "student" }));

function setup() {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false, staleTime: 0 } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe("auth", () => {
  it("useMe: 401 — это null, а не ошибка", async () => {
    resetMockDb();
    const { result } = renderHook(() => useMe(), setup());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("useLogin кладёт пользователя в кэш, useLogout его убирает", async () => {
    resetMockDb();
    const { wrapper } = setup();
    const { result } = renderHook(() => ({ me: useMe(), login: useLogin(), logout: useLogout() }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.me.data).toBeNull());

    await act(() => result.current.login.mutateAsync({ login: "student", password: "demo" }));
    await waitFor(() => expect(result.current.me.data).toEqual(fixtures.me.student));

    await act(() => result.current.logout.mutateAsync());
    await waitFor(() => expect(result.current.me.data).toBeNull());
  });

  it("неверный пароль — ApiClientError 401 с текстом из API", async () => {
    resetMockDb();
    const { result } = renderHook(() => useLogin(), setup());
    await act(async () => {
      await result.current.mutateAsync({ login: "student", password: "wrong" }).catch(() => {});
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(isApiError(result.current.error, 401)).toBe(true);
    expect(result.current.error?.message).toBe("Неверный логин или пароль");
  });
});

describe("данные студента", () => {
  type Hook = () => { isSuccess: boolean; data: unknown };
  const cases: [string, Hook, unknown][] = [
    ["useProfile", () => useProfile(), fixtures.profile],
    ["useSchedule", () => useSchedule("2026-11-18"), fixtures.weekSchedule],
    ["useGrades", () => useGrades(), fixtures.grades],
  ];
  it.each(cases)("%s отдаёт данные по схеме", async (_name, hook, expected) => {
    const { result } = renderHook(() => hook(), setup());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(expected);
  });

  it("useSchedule передаёт week в query", async () => {
    let seen: string | null = null;
    server.use(
      http.get("/api/me/schedule", ({ request }) => {
        seen = new URL(request.url).searchParams.get("week");
        return HttpResponse.json(fixtures.weekSchedule);
      }),
    );
    const { result } = renderHook(() => useSchedule("2026-11-18"), setup());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seen).toBe("2026-11-18");
  });

  it("useRequest: несуществующая (или чужая) заявка — 404", async () => {
    const { result } = renderHook(
      () => useRequest("00000000-0000-4000-8000-000000000000"),
      setup(),
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(isApiError(result.current.error, 404)).toBe(true);
  });

  it("ответ не по схеме — понятная ошибка, а не поломка экрана", async () => {
    server.use(http.get("/api/me/grades", () => HttpResponse.json({ nope: true })));
    const { result } = renderHook(() => useGrades(), setup());
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Сервер ответил в неожиданном формате.");
  });

  it("сеть недоступна — ApiClientError со статусом 0", async () => {
    server.use(http.get("/api/me/profile", () => HttpResponse.error()));
    const { result } = renderHook(() => useProfile(), setup());
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(isApiError(result.current.error, 0)).toBe(true);
  });
});

describe("заявки и уведомления", () => {
  it("useCreateRequest: новая заявка появляется в списке первой", async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => ({ list: useRequests(), create: useCreateRequest() }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.list.data).toHaveLength(3));

    let id = "";
    await act(async () => {
      id = (
        await result.current.create.mutateAsync({ type: "transcript", comment: "Для стажировки" })
      ).id;
    });
    await waitFor(() => expect(result.current.list.data).toHaveLength(4));
    expect(result.current.list.data?.[0]).toMatchObject({
      id,
      status: "submitted",
      type: "transcript",
    });
  });

  it("useMarkRead уменьшает счётчик непрочитанных", async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => ({ list: useNotifications(), read: useMarkRead() }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.list.data?.unreadCount).toBe(2));
    const unread = result.current.list.data?.items.find((n) => !n.read);
    await act(() => result.current.read.mutateAsync(unread?.id ?? ""));
    await waitFor(() => expect(result.current.list.data?.unreadCount).toBe(1));
  });
});

describe("сотрудник", () => {
  it("студенту очередь недоступна — 403", async () => {
    const { result } = renderHook(() => useStaffRequests(), setup());
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(isApiError(result.current.error, 403)).toBe(true);
  });

  it("смена статуса: очередь обновляется, студент получает уведомление", async () => {
    resetMockDb({ as: "staff" });
    const staff = setup();
    const { result } = renderHook(
      () => ({
        queue: useStaffRequests({ status: "submitted" }),
        change: useChangeRequestStatus(),
      }),
      { wrapper: staff.wrapper },
    );
    await waitFor(() => expect(result.current.queue.data).toHaveLength(1));
    const id = result.current.queue.data?.[0]?.id ?? "";

    await act(() =>
      result.current.change.mutateAsync({ id, status: "in_review", comment: "Взяли в работу" }),
    );
    await waitFor(() => expect(result.current.queue.data).toHaveLength(0));

    // Тот же сценарий глазами студента.
    await act(async () => {
      await fetch(new URL("/api/auth/login", location.href), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ login: "student", password: "demo" }),
      });
    });
    const student = setup();
    const { result: s } = renderHook(() => ({ req: useRequest(id), notes: useNotifications() }), {
      wrapper: student.wrapper,
    });
    await waitFor(() => expect(s.current.req.data?.status).toBe("in_review"));
    expect(s.current.req.data?.history.at(-1)?.comment).toBe("Взяли в работу");
    await waitFor(() => expect(s.current.notes.data?.unreadCount).toBe(3));
    expect(s.current.notes.data?.items[0]?.link).toBe(`/requests/${id}`);
  });
});
