// `pnpm db:migrate`: применить миграции к БД из окружения.
import { createDbFromEnv } from "./client";

const handle = await createDbFromEnv();
await handle.migrate();
await handle.close();
console.log(`Миграции применены (${handle.driver})`);
