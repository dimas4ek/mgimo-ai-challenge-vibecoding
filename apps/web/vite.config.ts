import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { msw } from "msw/vite";
import { defineConfig, loadEnv } from "vite";

// .env один на весь репозиторий и лежит в корне.
const envDir = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, "");
  // В dev фронт ходит на /api того же origin, Vite проксирует запросы в API.
  const proxy = { "/api": `http://127.0.0.1:${env.PORT || "3000"}` };
  return {
    envDir,
    plugins: [
      react(),
      tailwindcss(),
      // Отдаёт /mockServiceWorker.js для моков (VITE_USE_MOCKS=true). Только dev-сервер: в сборку не попадает.
      { ...msw({ mode: "worker-only" }), apply: "serve" },
    ],
    server: { proxy },
    preview: { proxy },
    // Общая настройка тестов: таймауты Testing Library под параллельный `pnpm test`.
    test: { setupFiles: ["./src/test-setup.ts"] },
  };
});
