import { IdSchema, routes } from "@aihs/contract";
import { Hono } from "hono";
import type { AppEnv } from "../../env";
import { apiError } from "../../http/errors";
import { validate } from "../../http/validate";
import { getDiscussionReport, listDiscussionReports, resolveDiscussionReport } from "./service";

export function staffDiscussionReportRoutes() {
  const { list, get, resolve } = routes.staff.discussionReports;
  return new Hono<AppEnv>()
    .get(list.path, async (c) => c.json(await listDiscussionReports(c.var.db)))
    .get(get.path, async (c) => {
      const id = IdSchema.safeParse(c.req.param("id"));
      const report = id.success ? await getDiscussionReport(c.var.db, id.data) : null;
      return report ? c.json(report) : apiError(c, 404, "not_found", "Жалоба не найдена");
    })
    .post(resolve.path, validate("json", resolve.body), async (c) => {
      const id = IdSchema.safeParse(c.req.param("id"));
      const result = id.success
        ? await resolveDiscussionReport(
            c.var.db,
            c.var.user.id,
            id.data,
            c.req.valid("json"),
            c.var.now(),
          )
        : { kind: "not_found" as const };
      if (result.kind === "resolved") return c.json(result.report);
      if (result.kind === "already_resolved")
        return apiError(c, 409, "already_resolved", "По жалобе уже принято решение");
      return apiError(c, 404, "not_found", "Жалоба не найдена");
    });
}
