import { renderToString } from "react-dom/server";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { routeTree } from "./app/router";

function renderAt(url: string) {
  const router = createMemoryRouter(routeTree, { initialEntries: [url] });
  return renderToString(<RouterProvider router={router} />);
}

describe("App", () => {
  it("на входе — название и дисклеймер", () => {
    const html = renderAt("/login");
    expect(html).toContain("AI High School");
    expect(html).toContain("не официальный сервис");
  });
});
