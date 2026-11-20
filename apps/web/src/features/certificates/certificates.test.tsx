// @vitest-environment jsdom
import { fixtures, routes } from "@aihs/contract";
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createQueryClient } from "../../api/hooks";
import { paths } from "../../app/paths";
import { handlers, resetMockDb } from "../../mocks/handlers";
import { controlFormLabel, resultLabel } from "../grades/model";
import { CertificatePage } from "./CertificatePage";
import {
  certificateStatement,
  formatIssuedAt,
  formatIssuedOn,
  groupBySemester,
  verifyUrl,
} from "./model";
import { VerifyPage } from "./VerifyPage";

const cert = fixtures.certificateByRequestId[fixtures.ids.request1];
if (!cert) throw new Error("нет фикстуры справки");

describe("модель справок", () => {
  it("даты по Москве и адрес проверки", () => {
    // 21:30 UTC 13.11 — в Москве уже 14 ноября.
    expect(formatIssuedAt("2026-11-13T21:30:00.000Z")).toBe("14 ноября 2026 г.");
    expect(formatIssuedOn("2026-11-13")).toBe("13 ноября 2026 г.");
    expect(verifyUrl("/verify/abc", "https://aihs.example")).toBe(
      "https://aihs.example/verify/abc",
    );
  });

  it("у каждого типа справки свой текст", () => {
    const types = [
      "enrollment_certificate",
      "scholarship_certificate",
      "military_registration_certificate",
      "transcript",
    ] as const;
    const texts = types.map(certificateStatement);
    expect(new Set(texts).size).toBe(types.length);
    expect(certificateStatement("military_registration_certificate")).toMatch(/военн/);
    expect(certificateStatement("scholarship_certificate")).toMatch(/стипенди/);
  });
});

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
beforeEach(() => resetMockDb({ as: "student" }));

function open(url: string) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  const router = createMemoryRouter(
    [
      { path: paths.certificatePattern, element: <CertificatePage /> },
      { path: paths.verifyPattern, element: <VerifyPage /> },
    ],
    { initialEntries: [url] },
  );
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("справка для печати", () => {
  it("данные студента, номер, QR и адрес проверки, кнопка печати, пометка «образец»", async () => {
    open(paths.certificate(cert.requestId));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Справка об обучении" }),
    ).toBeTruthy();
    expect(screen.getByText(cert.student.fullName)).toBeTruthy();
    expect(screen.getByText(certificateStatement(cert.type))).toBeTruthy();
    expect(screen.getByText(`№ ${cert.number}`, { exact: false })).toBeTruthy();
    expect(screen.getByRole("img", { name: /QR-код для проверки/ })).toBeTruthy();
    expect(screen.getByText(new URL(cert.verifyPath, location.href).toString())).toBeTruthy();
    expect(screen.getByRole("button", { name: /Печать или PDF/ })).toBeTruthy();
    expect(screen.getByText("ОБРАЗЕЦ")).toBeTruthy();
    expect(screen.getAllByText(/не официальный сервис/).length).toBeGreaterThan(0);
  });

  it("справки нет (заявка не готова) — понятное сообщение и путь назад", async () => {
    open(paths.certificate(fixtures.ids.request2));
    expect(await screen.findByText("Справки пока нет")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Печать/ })).toBeNull();
  });

  it("заявку отклонили — не обещаем, что справка появится", async () => {
    const request = fixtures.requestById[fixtures.ids.request2];
    server.use(
      http.get(routes.me.requests.get.path, () =>
        HttpResponse.json({ ...request, status: "rejected" }),
      ),
    );
    open(paths.certificate(fixtures.ids.request2));
    expect(await screen.findByText("Справки не будет")).toBeTruthy();
    expect(screen.getByText(/Заявку отклонили/)).toBeTruthy();
    expect(screen.queryByText(/появится/)).toBeNull();
  });

  it("выписка: таблица оценок по семестрам из снимка справки; у справки об обучении таблицы нет", async () => {
    const transcript = fixtures.certificateByRequestId[fixtures.ids.request4];
    const first = transcript?.grades?.[0];
    if (!transcript?.grades || !first) throw new Error("нет фикстуры выписки");
    open(paths.certificate(transcript.requestId));
    const section = await screen.findByRole("region", { name: "Оценки на дату выдачи" });
    const semesters = new Set(transcript.grades.map((g) => g.semester));
    for (const s of semesters) {
      expect(within(section).getByRole("heading", { level: 3, name: s })).toBeTruthy();
    }
    // Таблица для широкого экрана и печати: строка на каждую оценку, подписи из модели успеваемости.
    const rows = within(section)
      .getAllByRole("row")
      .filter((r) => r.querySelector("td"));
    expect(rows).toHaveLength(transcript.grades.length);
    const firstRow = within(rows[0] as HTMLElement);
    expect(firstRow.getByText(first.subject)).toBeTruthy();
    expect(firstRow.getByText(controlFormLabel(first.controlForm))).toBeTruthy();
    expect(firstRow.getByText(String(first.totalPoints))).toBeTruthy();
    expect(firstRow.getByText(resultLabel(first.result).label)).toBeTruthy();
    cleanup();

    open(paths.certificate(cert.requestId));
    await screen.findByRole("heading", { level: 1, name: "Справка об обучении" });
    expect(screen.queryByRole("region", { name: "Оценки на дату выдачи" })).toBeNull();
  });

  it("выписка без итоговых оценок: раздел есть и честно говорит, что оценок нет", async () => {
    const transcript = fixtures.certificateByRequestId[fixtures.ids.request4];
    if (!transcript) throw new Error("нет фикстуры выписки");
    server.use(
      http.get(routes.me.certificates.get.path, () =>
        HttpResponse.json({ ...transcript, grades: [] }),
      ),
    );
    open(paths.certificate(transcript.requestId));
    const section = await screen.findByRole("region", { name: "Оценки на дату выдачи" });
    expect(within(section).getByText("Итоговых оценок на дату выдачи ещё не было.")).toBeTruthy();
    expect(within(section).queryAllByRole("row")).toHaveLength(0);
  });

  it("группировка по семестрам сохраняет порядок", () => {
    const g = (semester: string, subject: string) => ({
      semester,
      subject,
      controlForm: "exam" as const,
      credits: 3,
      totalPoints: 70,
      result: "good" as const,
    });
    expect(
      groupBySemester([g("В", "1"), g("В", "2"), g("О", "3")]).map((x) => [
        x.semester,
        x.items.length,
      ]),
    ).toEqual([
      ["В", 2],
      ["О", 1],
    ]);
  });

  it("ошибка сервера — «Повторить»", async () => {
    server.use(
      http.get(routes.me.certificates.get.path, () => HttpResponse.json({}, { status: 500 })),
    );
    open(paths.certificate(cert.requestId));
    expect(await screen.findByRole("button", { name: "Повторить" })).toBeTruthy();
  });
});

describe("публичная проверка", () => {
  it("без входа: «действительна», тип, номер, дата и только инициалы", async () => {
    resetMockDb();
    open(paths.verify(cert.token));
    expect(await screen.findByRole("heading", { name: "Справка действительна" })).toBeTruthy();
    expect(screen.getByText("Справка об обучении")).toBeTruthy();
    expect(screen.getByText(cert.number)).toBeTruthy();
    expect(screen.getByText("13 ноября 2026 г.")).toBeTruthy();
    expect(screen.getByText("Л. М. И.")).toBeTruthy();
    expect(screen.queryByText(cert.student.fullName)).toBeNull();
    expect(screen.queryByText(cert.student.group)).toBeNull();
  });

  it("проверка выписки не показывает оценки", async () => {
    resetMockDb();
    const transcript = fixtures.certificateByRequestId[fixtures.ids.request4];
    // В фикстурах проверка есть только у справки об обучении — отвечаем за выписку так же, по контракту.
    server.use(
      http.get(routes.public.certificates.verify.path, () =>
        HttpResponse.json({
          type: "transcript",
          number: transcript?.number,
          issuedOn: "2026-11-17",
          valid: true,
          holderInitials: "Л. М. И.",
        }),
      ),
    );
    open(paths.verify(transcript?.token ?? ""));
    expect(await screen.findByRole("heading", { name: "Справка действительна" })).toBeTruthy();
    for (const g of transcript?.grades ?? []) expect(screen.queryByText(g.subject)).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("неизвестный токен — «не найдена»; токен неверного формата — без запроса", async () => {
    open(paths.verify("A".repeat(43)));
    expect(await screen.findByRole("heading", { name: "Справка не найдена" })).toBeTruthy();
    cleanup();
    server.use(
      http.get(routes.public.certificates.verify.path, () => {
        throw new Error("запрос не должен уходить");
      }),
    );
    open(paths.verify("not-a-token"));
    expect(screen.getByRole("heading", { name: "Справка не найдена" })).toBeTruthy();
  });
});
