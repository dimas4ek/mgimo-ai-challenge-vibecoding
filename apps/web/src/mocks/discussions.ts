import { type ApiError, type DiscussionTopic, fixtures, type Me, routes } from "@aihs/contract";
import { HttpResponse, http } from "msw";

type Entry = { departmentOwner: string | null; topic: DiscussionTopic };

const endpoint = routes.me.discussions;
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
  const reports = new Set<string>();
  const reset = () => {
    topics = examples();
    reports.clear();
  };
  const accessError = (me: Me | null) =>
    me
      ? error(403, "forbidden", "Только для студентов")
      : error(401, "unauthorized", "Нужно войти");
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
      const comment = topics
        .filter((entry) => canRead(entry, me.id))
        .flatMap(({ topic }) => topic.comments)
        .find((item) => item.id === params.commentId && item.visibility !== "hidden");
      if (!comment) return error(404, "not_found", "Комментарий не найден");
      const key = `${me.id}:${comment.id}`;
      if (reports.has(key)) return error(409, "duplicate_report", "Жалоба уже отправлена");
      reports.add(key);
      const receipt = endpoint.report.response.parse({
        id: crypto.randomUUID(),
        status: "pending",
        createdAt: new Date().toISOString(),
      });
      return HttpResponse.json(receipt, { status: 201 });
    }),
  ];

  return { handlers, reset };
}
