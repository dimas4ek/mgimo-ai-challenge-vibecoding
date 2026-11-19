// `pnpm db:seed`: заполнить БД из окружения демо-данными (миграции должны быть применены).
import { createDbFromEnv } from "../client";
import { seed } from "./index";

const handle = await createDbFromEnv();
await seed(handle.db, { now: new Date() });
await handle.close();
console.log(`Сид применён (${handle.driver})`);
