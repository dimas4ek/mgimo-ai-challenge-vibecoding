import {
  type ApiError,
  type DiscussionTopic,
  fixtures,
  type Me,
  routes,
  type StaffDiscussionReport,
} from "@aihs/contract";
import { HttpResponse, http } from "msw";

type Entry = { departmentOwner: string | null; topic: DiscussionTopic };
type MockReport = { reporterId: string; report: StaffDiscussionReport };

const endpoint = routes.me.discussions;
const staff = routes.staff.discussionReports;
const timestamp = "2026-11-22T12:00:00.000Z";

function examples(): Entry[] {
  const entries = [
    ["Идеи для недели студенческих проектов", fixtures.me.student, null],
    ["Практикум по нейросетям", fixtures.me.student, fixtures.me.student.id],
    ["Встреча клуба аналитиков", fixtures.me.student2, fixtures.me.student2.id],
  ] as const;
  return entries.map(([title, author, departmentOwner], index) => ({
    departmentOwner,
    topic: {
      id: `5e785af4-e7a5-4e3a-aeb4-2539b9c07b0${index}`,
      scope: departmentOwner ? "department" : "university",
      title,
      body: "Предложите тему для следующей встречи.",
      author: { displayName: author.displayName },
      createdAt: timestamp,
      comments:
        index === 0
          ? [
              {
                id: "5e785af4-e7a5-4e3a-aeb4-2539b9c07b10",
                body: "Можем показать, как визуализируем расписание.",
                author: { displayName: fixtures.me.student2.displayName },
                createdAt: timestamp,
                visibility: "visible",
              },
            ]
          : [],
    },
  }));
}

const error = (status: number, code: string, message: string) =>
  HttpResponse.json({ error: { code, message } } satisfies ApiError, { status });
const invalid = () => error(400, "validation", "Проверьте введённые данные");
const notFound = () => error(404, "not_found", "Тема не найдена");

export function mockDiscussions(readMe: () => Me | null) {
  let topics = examples();
  let reports: MockReport[] = [];
  const reset = () => {
    topics = examples();
    reports = [];
  };
  const accessError = (me: Me | null) =>
    me
      ? error(403, "forbidden", "Только для студентов")
      : error(401, "unauthorized", "Нужно войти");
  const staffAccess = () => {
    const me = readMe();
    if (!me) return error(401, "unauthorized", "Нужно войти");
    if (me.role !== "staff") return error(403, "forbidden", "Недостаточно прав");
    return null;
  };
  const reportMissing = () => error(404, "not_found", "Жалоба не найдена");
  const canRead = ({ departmentOwner }: Entry, userId: string) =>
    departmentOwner === null || departmentOwner === userId;
  const find = (id: unknown, userId: string) =>
    topics.find((entry) => entry.topic.id === id && canRead(entry, userId))?.topic;

  const handlers = [
    http.get(endpoint.list.path, ({ request }) => {
      const me = readMe();
      if (me?.role !== "student") return accessError(me);
      const scope = endpoint.list.query.safeParse({
        scope: new URL(request.url).searchParams.get("scope"),
      });
      if (!scope.success) return invalid();
      const departmentOwner = scope.data.scope === "department" ? me.id : null;
      return HttpResponse.json(
        endpoint.list.response.parse(
          topics
            .filter((entry) => entry.departmentOwner === departmentOwner)
            .map(({ topic }) => topic),
        ),
      );
    }),
    http.get(endpoint.get.path, ({ params }) => {
      const me = readMe();
      if (me?.role !== "student") return accessError(me);
      const topic = find(params.id, me.id);
      return topic ? HttpResponse.json(topic) : notFound();
    }),
    http.post(endpoint.create.path, async ({ request }) => {
      const me = readMe();
      if (me?.role !== "student") return accessError(me);
      const input = endpoint.create.body.safeParse(await request.json().catch(() => null));
      if (!input.success) return invalid();
      const topic: DiscussionTopic = {
        ...input.data,
        id: crypto.randomUUID(),
        author: { displayName: me.displayName },
        createdAt: new Date().toISOString(),
        comments: [],
      };
      topics.unshift({ departmentOwner: topic.scope === "department" ? me.id : null, topic });
      return HttpResponse.json(topic, { status: 201 });
    }),
    http.post(endpoint.comment.path, async ({ request, params }) => {
      const me = readMe();
      if (me?.role !== "student") return accessError(me);
      const topic = find(params.id, me.id);
      if (!topic) return notFound();
      const input = endpoint.comment.body.safeParse(await request.json().catch(() => null));
      if (!input.success) return invalid();
      const comment = {
        ...input.data,
        id: crypto.randomUUID(),
        author: { displayName: me.displayName },
        createdAt: new Date().toISOString(),
      };
      topic.comments.push(comment);
      return HttpResponse.json(comment, { status: 201 });
    }),
    http.post(endpoint.report.path, async ({ request, params }) => {
      const me = readMe();
      if (me?.role !== "student") return accessError(me);
      const input = endpoint.report.body.safeParse(await request.json().catch(() => null));
      if (!input.success) return invalid();
      const match = topics
        .filter((entry) => canRead(entry, me.id))
        .flatMap(({ topic }) => topic.comments.map((comment) => ({ topic, comment })))
        .find(({ comment }) => comment.id === params.commentId);
      if (!match || match.comment.visibility === "hidden")
        return error(404, "not_found", "Комментарий не найден");
      const { topic, comment } = match;
      if (
        reports.some((entry) => entry.reporterId === me.id && entry.report.commentId === comment.id)
      )
        return error(409, "duplicate_report", "Жалоба уже отправлена");
      const receipt = endpoint.report.response.parse({
        id: crypto.randomUUID(),
        status: "pending",
        createdAt: new Date().toISOString(),
      });
      reports.unshift({
        reporterId: me.id,
        report: {
          ...receipt,
          reason: input.data.reason,
          resolvedAt: null,
          topic: { id: topic.id, title: topic.title },
          commentId: comment.id,
          comment: {
            body: comment.body,
            author: comment.author,
            createdAt: comment.createdAt,
            visibility: "visible",
          },
        },
      });
      return HttpResponse.json(receipt, { status: 201 });
    }),
    http.get(staff.list.path, () => {
      const denied = staffAccess();
      if (denied) return denied;
      const queue = reports
        .map(({ report }) => report)
        .sort(
          (first, second) =>
            Number(second.status === "pending") - Number(first.status === "pending"),
        );
      return HttpResponse.json(staff.list.response.parse(queue));
    }),
    http.get(staff.get.path, ({ params }) => {
      const denied = staffAccess();
      if (denied) return denied;
      const entry = reports.find(({ report }) => report.id === params.id);
      return entry ? HttpResponse.json(entry.report) : reportMissing();
    }),
    http.post(staff.resolve.path, async ({ request, params }) => {
      const denied = staffAccess();
      if (denied) return denied;
      const input = staff.resolve.body.safeParse(await request.json().catch(() => null));
      if (!input.success) return invalid();
      const entry = reports.find(({ report }) => report.id === params.id);
      if (!entry) return reportMissing();
      const report = entry.report;
      if (report.status !== "pending")
        return error(409, "already_resolved", "По жалобе уже принято решение");
      const now = new Date().toISOString();
      report.resolvedAt = now;
      report.status = input.data.decision === "hide" ? "hidden" : "dismissed";
      if (report.status === "hidden") {
        const topic = topics.find((entry) => entry.topic.id === report.topic.id)?.topic;
        if (topic)
          topic.comments = topic.comments.map((comment) =>
            comment.id === report.commentId
              ? { ...comment, visibility: "hidden", body: null }
              : comment,
          );
        for (const { report: related } of reports.filter(
          (entry) => entry.report.commentId === report.commentId,
        )) {
          related.comment.visibility = "hidden";
          if (related.status === "pending") {
            related.status = "hidden";
            related.resolvedAt = now;
          }
        }
      }
      return HttpResponse.json(report);
    }),
  ];

  return { handlers, reset };
}
