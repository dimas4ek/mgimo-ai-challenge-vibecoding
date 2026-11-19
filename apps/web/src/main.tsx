import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("Нет элемента #root в index.html");

/**
 * Моки только в dev и только по флагу `VITE_USE_MOCKS=true`. Условие `import.meta.env.DEV`
 * Vite заменяет на `false` в прод-сборке, и динамический импорт вместе с MSW выпадает из бандла.
 */
async function enableMocks() {
  if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === "true") {
    const { startMocks } = await import("./mocks/browser");
    await startMocks();
  }
}

enableMocks().finally(() => {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
