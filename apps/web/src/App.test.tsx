import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("рендерит название и дисклеймер", () => {
    const html = renderToString(<App />);
    expect(html).toContain("AI High School");
    expect(html).toContain("не официальный сервис");
  });
});
