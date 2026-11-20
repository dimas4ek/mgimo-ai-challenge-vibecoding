import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { createDbFromEnv } from "./db/client";
import { refreshSafely, startDemoDataRefresh } from "./db/seed/refresh";

const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOST ?? "0.0.0.0";

const handle = await createDbFromEnv();
await handle.migrate();
// Демо-данные — на текущую неделю по Москве: пустая база засевается, база с прошлой недели
// пересевается (иначе к концу судейства расписание опустеет). Дальше проверка раз в час.
await refreshSafely(handle.db, new Date());
startDemoDataRefresh(handle.db);

const app = createApp({ db: handle.db, staticDir: process.env.STATIC_DIR || undefined });

serve({ fetch: app.fetch, port, hostname }, (info) => {
  console.log(`API слушает порт ${info.port} (БД: ${handle.driver})`);
});
