import {
  type ApiError,
  ChangeStatusInputSchema,
  CreateRequestInputSchema,
  fixtures,
  LoginInputSchema,
  type Me,
  type Notification,
  type Request,
  type RequestListItem,
  routes,
  type StaffRequestItem,
} from "@aihs/contract";
import { type HttpHandler, HttpResponse, http } from "msw";

/**
 * MSW-хендлеры всех роутов контракта поверх фикстур `@aihs/contract`.
 * Держат маленькую «базу» в памяти, чтобы сценарий «подал заявку → сотрудник сменил статус →
 * пришло уведомление» работал и в dev без API, и в тестах хуков.
 *
 * Вход в моках (только dev/тесты, не настоящие аккаунты): логин `student`, `student2` или `staff`,
 * любой непустой пароль кроме `wrong`.
 */

const STUDENT = { fullName: "Лебедянская Мирослава Игоревна", group: "ПИИ-301" };

type Db = {
  me: Me | null;
  requests: Request[];
  notifications: Notification[];
};

const fresh = (): Db => ({
  me: null,
  requests: structuredClone(Object.values(fixtures.requestById)).filter(
    (r): r is Request => r !== undefined,
  ),
  notifications: structuredClone(fixtures.notifications.items) as Notification[],
});

let db = fresh();

/** Сбросить «базу» моков к фикстурам. В тестах — перед каждым тестом. */
export function resetMockDb(options?: { as?: keyof typeof fixtures.me }): void {
  db = fresh();
  if (options?.as) db.me = fixtures.me[options.as];
}

const error = (status: number, code: string, message: string) =>
  HttpResponse.json({ error: { code, message } } satisfies ApiError, { status });

const unauthorized = () => error(401, "unauthorized", "Нужно войти");
const notFound = () => error(404, "not_found", "Не найдено");
const byNewest = <T extends { createdAt: string }>(a: T, b: T) =>
  b.createdAt.localeCompare(a.createdAt);
const toItem = ({ history: _h, ...item }: Request): RequestListItem => item;
const now = () => new Date().toISOString();

function requireStudent() {
  if (!db.me) return unauthorized();
  if (db.me.role !== "student") return error(403, "forbidden", "Только для студентов");
  return null;
}

function requireStaff() {
  if (!db.me) return unauthorized();
  if (db.me.role !== "staff") return error(403, "forbidden", "Только для сотрудников");
  return null;
}

const staffItem = (r: Request): StaffRequestItem => ({ ...r, student: STUDENT });

export const handlers: HttpHandler[] = [
  http.get(routes.health.path, () => HttpResponse.json({ status: "ok" })),

  // ── auth ──
  http.post(routes.auth.login.path, async ({ request }) => {
    const input = LoginInputSchema.safeParse(await request.json().catch(() => null));
    const who = input.success ? input.data.login : "";
    if (!input.success || input.data.password === "wrong" || !(who in fixtures.me)) {
      return error(401, "invalid_credentials", "Неверный логин или пароль");
    }
    db.me = fixtures.me[who as keyof typeof fixtures.me];
    return HttpResponse.json(db.me);
  }),
  http.post(routes.auth.logout.path, () => {
    db.me = null;
    return HttpResponse.json({ ok: true });
  }),
  http.get(routes.auth.me.path, () => (db.me ? HttpResponse.json(db.me) : unauthorized())),

  // ── студент ──
  http.get(routes.me.profile.path, () => requireStudent() ?? HttpResponse.json(fixtures.profile)),
  http.get(
    routes.me.schedule.path,
    () => requireStudent() ?? HttpResponse.json(fixtures.weekSchedule),
  ),
  http.get(routes.me.grades.path, () => requireStudent() ?? HttpResponse.json(fixtures.grades)),
  http.post(routes.me.demoReset.path, () => {
    const denied = requireStudent();
    if (denied) return denied;
    const me = db.me;
    db = fresh();
    db.me = me;
    return HttpResponse.json({ ok: true as const });
  }),

  http.get(
    routes.me.requests.list.path,
    () => requireStudent() ?? HttpResponse.json([...db.requests].sort(byNewest).map(toItem)),
  ),
  http.post(routes.me.requests.create.path, async ({ request }) => {
    const denied = requireStudent();
    if (denied) return denied;
    const input = CreateRequestInputSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) return error(400, "validation", "Проверьте поля формы");
    const at = now();
    const created: Request = {
      id: crypto.randomUUID(),
      type: input.data.type,
      status: "submitted",
      comment: input.data.comment ?? null,
      createdAt: at,
      updatedAt: at,
      history: [{ status: "submitted", at, comment: null }],
    };
    db.requests.push(created);
    return HttpResponse.json(created, { status: 201 });
  }),
  http.get(routes.me.requests.get.path, ({ params }) => {
    const denied = requireStudent();
    if (denied) return denied;
    const found = db.requests.find((r) => r.id === params.id);
    return found ? HttpResponse.json(found) : notFound();
  }),

  http.get(routes.me.notifications.list.path, () => {
    const denied = requireStudent();
    if (denied) return denied;
    const items = [...db.notifications].sort(byNewest);
    return HttpResponse.json({ items, unreadCount: items.filter((n) => !n.read).length });
  }),
  http.post(routes.me.notifications.markRead.path, ({ params }) => {
    const denied = requireStudent();
    if (denied) return denied;
    const found = db.notifications.find((n) => n.id === params.id);
    if (!found) return notFound();
    found.read = true;
    return HttpResponse.json(found);
  }),

  // ── сотрудник ──
  http.get(routes.staff.requests.list.path, ({ request }) => {
    const denied = requireStaff();
    if (denied) return denied;
    const status = new URL(request.url).searchParams.get("status");
    const list = db.requests.filter((r) => !status || r.status === status).sort(byNewest);
    return HttpResponse.json(list.map(staffItem));
  }),
  http.post(routes.staff.requests.changeStatus.path, async ({ params, request }) => {
    const denied = requireStaff();
    if (denied) return denied;
    const input = ChangeStatusInputSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) return error(400, "validation", "Проверьте поля формы");
    const found = db.requests.find((r) => r.id === params.id);
    if (!found) return notFound();
    const at = now();
    found.status = input.data.status;
    found.updatedAt = at;
    found.history.push({ status: input.data.status, at, comment: input.data.comment ?? null });
    db.notifications.push({
      id: crypto.randomUUID(),
      type: "request",
      title: "Статус заявки изменился",
      body: input.data.comment ?? "Откройте заявку, чтобы посмотреть подробности.",
      createdAt: at,
      read: false,
      link: `/requests/${found.id}`,
    });
    return HttpResponse.json(staffItem(found));
  }),
];
