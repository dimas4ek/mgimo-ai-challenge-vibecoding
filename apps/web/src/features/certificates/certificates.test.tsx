// @vitest-environment jsdom
import { fixtures, routes } from "@aihs/contract";
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createQueryClient } from "../../api/hooks";
import { paths } from "../../app/paths";
import { handlers, resetMockDb } from "../../mocks/handlers";
import { CertificatePage } from "./CertificatePage";
import { formatIssuedAt, formatIssuedOn, verifyUrl } from "./model";
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
