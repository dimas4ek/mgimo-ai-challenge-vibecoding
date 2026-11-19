import { CertificateTokenSchema, IdSchema, routes } from "@aihs/contract";
import { Hono } from "hono";
import { requireAuth, requireRole } from "../../auth/middleware";
import type { AppEnv } from "../../env";
import { apiError } from "../../http/errors";
import { getCertificate, verifyCertificate } from "./service";

/**
 * `GET /api/me/certificates/:requestId` — только студент, id студента из сессии.
 * `GET /api/public/certificates/:token` — без входа, для страницы проверки по QR.
 * Невалидный id или токен → 404, как и чужая или неготовая справка.
 */
export function certificateRoutes() {
  return new Hono<AppEnv>()
    .use("/api/me/certificates/*", requireAuth, requireRole("student"))
    .get(routes.me.certificates.get.path, async (c) => {
      const studentId = c.var.user.studentId;
      if (!studentId) throw new Error("у студента в сессии нет studentId");
      const id = IdSchema.safeParse(c.req.param("requestId"));
      const found = id.success
        ? await getCertificate(c.var.db, studentId, id.data, c.var.now())
        : null;
      return found ? c.json(found) : apiError(c, 404, "not_found", "Справка не найдена");
    })
    .get(routes.public.certificates.verify.path, async (c) => {
      const token = CertificateTokenSchema.safeParse(c.req.param("token"));
      const found = token.success ? await verifyCertificate(c.var.db, token.data) : null;
      return found ? c.json(found) : apiError(c, 404, "not_found", "Справка не найдена");
    });
}
