import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { createDbFromEnv } from "./db/client";

const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOST ?? "0.0.0.0";

const handle = await createDbFromEnv();
await handle.migrate();
const app = createApp({ db: handle.db });

serve({ fetch: app.fetch, port, hostname }, (info) => {
  console.log(`API слушает порт ${info.port} (БД: ${handle.driver})`);
});
