import { IdSchema, routes } from "@aihs/contract";
import { Hono } from "hono";
import { requireAuth, requireRole } from "../../auth/middleware";
import type { AppEnv } from "../../env";
import { apiError } from "../../http/errors";
import { validate } from "../../http/validate";
import { addDiscussionComment, createDiscussion, getDiscussion, listDiscussions } from "./service";

export function discussionRoutes() {
  const { list, create, get, comment } = routes.me.discussions;
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
    });
}
