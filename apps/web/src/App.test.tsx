import { QueryClientProvider } from "@tanstack/react-query";
import { renderToString } from "react-dom/server";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { createQueryClient, queryKeys } from "./api/hooks";
import { routeTree } from "./app/router";

function renderAt(url: string) {
  const client = createQueryClient();
  client.setQueryData(queryKeys.me, null);
  const router = createMemoryRouter(routeTree, { initialEntries: [url] });
  return renderToString(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("App", () => {
  it("на входе — название и дисклеймер", () => {
    const html = renderAt("/login");
    expect(html).toContain("AI High School");
    expect(html).toContain("не официальный сервис");
  });
});
