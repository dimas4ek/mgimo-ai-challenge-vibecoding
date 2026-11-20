import {
  ApiErrorSchema,
  buildPath,
  CertificateSchema,
  CertificateVerificationSchema,
  GradesSchema,
  type RequestListItem,
  RequestListItemSchema,
  RequestSchema,
  routes,
} from "@aihs/contract";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { createApp } from "../../app";
import { createDb, type DbHandle } from "../../db/client";
import { grades, requests, subjects } from "../../db/schema";
import { seed, seedAccounts } from "../../db/seed";
import { seedId } from "../../db/seed/data";
import { initialsOf } from "./service";

const NOW = new Date("2026-11-19T09:00:00Z");
let handle: DbHandle;
let app: ReturnType<typeof createApp>;
const cookies: Record<keyof typeof seedAccounts, string> = { student: "", student2: "", staff: "" };
const myRequests: Record<"student" | "student2", RequestListItem[]> = { student: [], student2: [] };

beforeAll(async () => {
  handle = await createDb({ url: "" });
  await handle.migrate();
  await seed(handle.db, { now: NOW });
  app = createApp({ db: handle.db, now: () => NOW });
  for (const who of Object.keys(seedAccounts) as (keyof typeof seedAccounts)[]) {
    const res = await app.request(routes.auth.login.path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(seedAccounts[who]),
    });
    expect(res.status).toBe(200);
    cookies[who] = (res.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
  }
  for (const who of ["student", "student2"] as const) {
    const res = await app.request(routes.me.requests.list.path, as(who));
    myRequests[who] = z.array(RequestListItemSchema).parse(await res.json());
  }
});

afterAll(async () => {
  await handle.close();
});

const as = (who: keyof typeof cookies | null): RequestInit => ({
  headers: who ? { cookie: cookies[who] } : {},
});

/** Заявка студента из сида по типу. */
function requestOf(who: "student" | "student2", type: RequestListItem["type"]): RequestListItem {
  const found = myRequests[who].find((r) => r.type === type);
  if (!found) throw new Error(`в сиде у ${who} нет заявки ${type}`);
  return found;
}

const getCertificate = (who: keyof typeof cookies | null, requestId: string) =>
  app.request(buildPath(routes.me.certificates.get.path, { requestId }), as(who));

const verify = (token: string) =>
  app.request(buildPath(routes.public.certificates.verify.path, { token }));

const errorCode = async (res: Response) => ApiErrorSchema.parse(await res.json()).error.code;

describe("GET /api/me/certificates/:requestId", () => {
  it("готовая справка: данные для печати и токен проверки", async () => {
    const request = requestOf("student", "enrollment_certificate");
    expect(request.status).toBe("ready");
    const res = await getCertificate("student", request.id);
    expect(res.status).toBe(200);
    const cert = CertificateSchema.parse(await res.json());
    expect(cert.requestId).toBe(request.id);
    expect(cert.type).toBe("enrollment_certificate");
    expect(cert.issuedAt).toBe(request.updatedAt);
    expect(cert.verifyPath).toBe(`/verify/${cert.token}`);
    expect(cert.number).toMatch(/^AIHS-2026-[0-9A-F]{8}$/);
    expect(cert.student).toMatchObject({
      fullName: "Лебедянская Мирослава Игоревна",
      group: "ПИИ-301",
    });
    expect(cert.purpose).toBe(request.comment);
  });

  it("повторное открытие отдаёт тот же токен и номер", async () => {
    const { id } = requestOf("student", "enrollment_certificate");
    const first = CertificateSchema.parse(await (await getCertificate("student", id)).json());
    const second = CertificateSchema.parse(await (await getCertificate("student", id)).json());
    expect(second.token).toBe(first.token);
    expect(second.number).toBe(first.number);
  });

  it("у каждой справки свой токен", async () => {
    const mine = await getCertificate("student", requestOf("student", "enrollment_certificate").id);
    const other = await getCertificate(
      "student2",
      requestOf("student2", "military_registration_certificate").id,
    );
    expect(other.status).toBe(200);
    const a = CertificateSchema.parse(await mine.json());
    const b = CertificateSchema.parse(await other.json());
    expect(a.token).not.toBe(b.token);
    expect(b.student.fullName).toContain("Колосовский");
  });

  it("чужая справка → 404, а не 403", async () => {
    const { id } = requestOf("student2", "military_registration_certificate");
    const res = await getCertificate("student", id);
    expect(res.status).toBe(404);
    expect(await errorCode(res)).toBe("not_found");
  });

  it("справка ещё не готова → 404", async () => {
    const { id, status } = requestOf("student", "scholarship_certificate");
    expect(status).toBe("submitted");
    expect((await getCertificate("student", id)).status).toBe(404);
  });

  it("отклонённая справка → 404", async () => {
    const { id, status } = requestOf("student2", "transcript");
    expect(status).toBe("rejected");
    expect((await getCertificate("student2", id)).status).toBe(404);
  });

  it("готовое заявление (не справка) → 404", async () => {
    const { id } = requestOf("student", "retake_application");
    await handle.db.update(requests).set({ status: "ready" }).where(eq(requests.id, id));
    expect((await getCertificate("student", id)).status).toBe(404);
  });

  it("несуществующий и невалидный id → 404", async () => {
    const missing = await getCertificate("student", "00000000-0000-4000-8000-000000000000");
    expect(missing.status).toBe(404);
    expect((await getCertificate("student", "not-a-uuid")).status).toBe(404);
  });

  it("без сессии → 401, сотруднику → 403", async () => {
    const { id } = requestOf("student", "enrollment_certificate");
    expect((await getCertificate(null, id)).status).toBe(401);
    expect((await getCertificate("staff", id)).status).toBe(403);
  });
});

describe("выписка с оценками", () => {
  /** Студент подаёт выписку, сотрудник её выдаёт (`ready`). Возвращает id заявки. */
  async function issueTranscript(who: "student" | "student2"): Promise<string> {
    const created = await app.request(routes.me.requests.create.path, {
      method: "POST",
      headers: { cookie: cookies[who], "content-type": "application/json" },
      body: JSON.stringify({ type: "transcript", comment: "Для стажировки" }),
    });
    expect(created.status).toBe(201);
    const { id } = RequestSchema.parse(await created.json());
    const ready = await app.request(buildPath(routes.staff.requests.changeStatus.path, { id }), {
      method: "POST",
      headers: { cookie: cookies.staff, "content-type": "application/json" },
      body: JSON.stringify({ status: "ready" }),
    });
    expect(ready.status).toBe(200);
    return id;
  }

  const certificateOf = async (who: "student" | "student2", id: string) => {
    const res = await getCertificate(who, id);
    expect(res.status).toBe(200);
    return CertificateSchema.parse(await res.json());
  };

  /** Поменять баллы за семестр по предмету у студента прямо в БД, как это сделал бы преподаватель. */
  async function setSemesterPoints(who: "student" | "student2", subject: string, points: number) {
    const [row] = await handle.db
      .select({ id: grades.id })
      .from(grades)
      .innerJoin(subjects, eq(subjects.id, grades.subjectId))
      .where(and(eq(grades.studentId, seedId(`student:${who}`)), eq(subjects.name, subject)));
    if (!row) throw new Error(`нет оценки ${subject} у ${who}`);
    await handle.db.update(grades).set({ semesterPoints: points }).where(eq(grades.id, row.id));
  }

  it("выписка отдаёт оценки на момент выдачи и не меняется, если оценка потом изменилась", async () => {
    const id = await issueTranscript("student");
    const current = GradesSchema.parse(
      await (await app.request(routes.me.grades.path, as("student"))).json(),
    );
    const cert = await certificateOf("student", id);
    expect(cert.type).toBe("transcript");
    expect(cert.grades).not.toBeNull();
    const ml = cert.grades?.find((g) => g.subject === "Машинное обучение");
    const mlNow = current.disciplines.find((d) => d.subject === "Машинное обучение");
    if (!mlNow) throw new Error("в сиде нет «Машинного обучения»");
    expect(ml).toMatchObject({
      semester: current.semester,
      controlForm: mlNow.controlForm,
      credits: mlNow.credits,
      totalPoints: mlNow.totalPoints,
      result: mlNow.result,
    });
    expect(cert.grades).toHaveLength(current.disciplines.length);

    await setSemesterPoints("student", "Машинное обучение", 59);
    const again = await certificateOf("student", id);
    expect(again.grades).toEqual(cert.grades);
    const fresh = GradesSchema.parse(
      await (await app.request(routes.me.grades.path, as("student"))).json(),
    );
    const mlFresh = fresh.disciplines.find((d) => d.subject === "Машинное обучение");
    expect(mlFresh?.totalPoints).toBe(59 + (mlNow.examPoints ?? 0));
    expect(mlFresh?.totalPoints).not.toBe(ml?.totalPoints);
  });

  it("у справки другого типа grades: null", async () => {
    const cert = await certificateOf("student", requestOf("student", "enrollment_certificate").id);
    expect(cert.grades).toBeNull();
  });

  it("у каждого студента в выписке свои оценки, чужая выписка → 404", async () => {
    const id = await issueTranscript("student2");
    const cert = await certificateOf("student2", id);
    const subjectNames = cert.grades?.map((g) => g.subject) ?? [];
    expect(subjectNames).toContain("Линейная алгебра");
    expect(subjectNames).not.toContain("Машинное обучение");
    expect((await getCertificate("student", id)).status).toBe(404);
  });

  it("публичная проверка выписки оценок не содержит", async () => {
    const id = await issueTranscript("student");
    const cert = await certificateOf("student", id);
    const body = (await (await verify(cert.token)).json()) as Record<string, unknown>;
    expect(body).not.toHaveProperty("grades");
    expect(JSON.stringify(body)).not.toContain("Машинное обучение");
  });
});

describe("GET /api/public/certificates/:token", () => {
  it("без входа отдаёт только минимум: тип, номер, дату, «действительна», инициалы", async () => {
    const request = requestOf("student", "enrollment_certificate");
    const cert = CertificateSchema.parse(
      await (await getCertificate("student", request.id)).json(),
    );
    const res = await verify(cert.token);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    // Ровно эти поля: ни ФИО, ни группы, ни зачётки, ни оценок.
    expect(Object.keys(body).sort()).toEqual(
      ["holderInitials", "issuedOn", "number", "type", "valid"].sort(),
    );
    expect(CertificateVerificationSchema.parse(body)).toEqual({
      type: "enrollment_certificate",
      number: cert.number,
      issuedOn: "2026-11-13",
      valid: true,
      holderInitials: "Л. М. И.",
    });
    expect(JSON.stringify(body)).not.toContain("Лебедянская");
  });

  it("неизвестный токен → 404", async () => {
    const res = await verify("A".repeat(43));
    expect(res.status).toBe(404);
    expect(await errorCode(res)).toBe("not_found");
  });

  it("токен не той формы → 404", async () => {
    expect((await verify("short")).status).toBe(404);
    expect((await verify(`${"A".repeat(42)}!`)).status).toBe(404);
  });
});

describe("initialsOf", () => {
  it("фамилия, имя, отчество → инициалы", () => {
    expect(initialsOf("Лебедянская", "Мирослава", "Игоревна")).toBe("Л. М. И.");
  });

  it("без отчества — две буквы", () => {
    expect(initialsOf("Колосовский", "Тихон", null)).toBe("К. Т.");
  });
});
