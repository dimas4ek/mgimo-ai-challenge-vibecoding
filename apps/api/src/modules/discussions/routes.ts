import { IdSchema, routes } from "@aihs/contract";
import { Hono } from "hono";
import { requireAuth, requireRole } from "../../auth/middleware";
import type { AppEnv } from "../../env";
import { apiError } from "../../http/errors";
import { validate } from "../../http/validate";
import { createDiscussionReport } from "../discussion-reports/service";
import { addDiscussionComment, createDiscussion, getDiscussion, listDiscussions } from "./service";

export function discussionRoutes() {
  const { list, create, get, comment, report } = routes.me.discussions;
  return new Hono<AppEnv>()
    .use(list.path, requireAuth, requireRole("student"))
    .use(`${list.path}/*`, requireAuth, requireRole("student"))
    .get(list.path, validate("query", list.query), async (c) => {
      return c.json(
        await listDiscussions(c.var.db, c.var.user.studentId, c.req.valid("query").scope),
      );
    })
    .post(create.path, validate("json", create.body), async (c) => {
      const topic = await createDiscussion(c.var.db, c.var.user, c.req.valid("json"), c.var.now());
      return topic ? c.json(topic, 201) : apiError(c, 404, "not_found", "Кафедра не найдена");
    })
    .get(get.path, async (c) => {
      const id = IdSchema.safeParse(c.req.param("id"));
      const topic = id.success
        ? await getDiscussion(c.var.db, c.var.user.studentId, id.data)
        : null;
      return topic ? c.json(topic) : apiError(c, 404, "not_found", "Тема не найдена");
    })
    .post(comment.path, validate("json", comment.body), async (c) => {
      const id = IdSchema.safeParse(c.req.param("id"));
      const result = id.success
        ? await addDiscussionComment(
            c.var.db,
            c.var.user,
            id.data,
            c.req.valid("json"),
            c.var.now(),
          )
        : null;
      return result ? c.json(result, 201) : apiError(c, 404, "not_found", "Тема не найдена");
    })
    .post(report.path, validate("json", report.body), async (c) => {
      const commentId = IdSchema.safeParse(c.req.param("commentId"));
      const result = commentId.success
        ? await createDiscussionReport(
            c.var.db,
            c.var.user,
            commentId.data,
            c.req.valid("json"),
            c.var.now(),
          )
        : { kind: "not_found" as const };
      if (result.kind === "created") return c.json(result.receipt, 201);
      if (result.kind === "duplicate")
        return apiError(c, 409, "duplicate_report", "Жалоба уже отправлена");
      return apiError(c, 404, "not_found", "Комментарий не найден");
    });
}
