import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { createDbFromEnv } from "./db/client";
import { users } from "./db/schema";
import { seed } from "./db/seed";

const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOST ?? "0.0.0.0";

const handle = await createDbFromEnv();
await handle.migrate();
// Пустая БД (первый запуск) сразу получает демо-данные, чтобы тестовые аккаунты работали.
const [anyUser] = await handle.db.select({ id: users.id }).from(users).limit(1);
if (!anyUser) {
  await seed(handle.db, { now: new Date() });
  console.log("БД была пустой: применён сид демо-данных");
}
const app = createApp({ db: handle.db });

serve({ fetch: app.fetch, port, hostname }, (info) => {
  console.log(`API слушает порт ${info.port} (БД: ${handle.driver})`);
});
