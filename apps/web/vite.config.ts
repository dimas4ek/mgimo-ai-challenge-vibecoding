import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { msw } from "msw/vite";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { API_CACHE, OFFLINE_API_PATHS } from "./src/pwa-cache.ts";

// Пути API для офлайн-кэша: путь совпадает точно, query допускается (`?week=`).
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
const offlineApiPattern = new RegExp(
  `^[^?#]*(?:${OFFLINE_API_PATHS.map(escapeRe).join("|")})(?:[?#]|$)`,
);

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
      // PWA: установка на телефон и расписание офлайн. Service worker только в сборке (в dev его нет,
      // чтобы не мешать MSW и HMR).
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["icon.svg", "apple-touch-icon-180x180.png"],
        manifest: {
          name: "Цифровой деканат — AI High School",
          short_name: "Деканат AIHS",
          description: "Концепт личного кабинета студента. Вуз и все данные вымышлены.",
          lang: "ru",
          start_url: "/",
          scope: "/",
          display: "standalone",
          // Цвета светлой темы: --background и --primary из src/index.css в sRGB.
          background_color: "#f8fafd",
          theme_color: "#4143c7",
          icons: [
            { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
            { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
            {
              src: "maskable-icon-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          navigateFallback: "/index.html",
          // Оболочка, все чанки страниц (они грузятся лениво) и шрифт для русского и латиницы —
          // иначе офлайн текст падает на системный шрифт.
          globPatterns: [
            "**/*.{js,css,html,svg,png,webmanifest}",
            "assets/manrope-{cyrillic,latin}-wght-*.woff2",
          ],
          // Запросы /api — всегда с сервера (или из кэша ниже), не подменяются оболочкой SPA.
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              // Регулярка, а не функция: функция попадает в sw.js текстом и теряет импортированные
              // переменные, а RegExp сериализуется со значениями.
              urlPattern: offlineApiPattern,
              handler: "NetworkFirst",
              options: {
                cacheName: API_CACHE,
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 20, maxAgeSeconds: 14 * 24 * 60 * 60 },
                cacheableResponse: { statuses: [200] },
              },
            },
          ],
        },
      }),
    ],
    server: { proxy },
    preview: { proxy },
    // Общая настройка тестов: таймауты Testing Library под параллельный `pnpm test`.
    // testTimeout заметно больше asyncUtilTimeout (5 с в test-setup.ts): иначе медленный `findBy`
    // упирается в таймаут самого теста раньше, чем успевает дождаться.
    test: { setupFiles: ["./src/test-setup.ts"], testTimeout: 20_000 },
  };
});
