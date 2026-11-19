import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "./schema";

/** Drizzle-клиент со схемой. Одинаковый для PGlite и Postgres. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface CreateDbOptions {
  /** URL Postgres. По умолчанию `process.env.DATABASE_URL`; пустой → PGlite. */
  url?: string;
  /** Каталог данных PGlite. Не задан → БД в памяти (тесты). */
  pgliteDir?: string;
}

export interface DbHandle {
  db: Db;
  /** Какой движок под капотом. */
  driver: "pglite" | "postgres";
  /** Применить миграции из `src/db/migrations`. */
  migrate(): Promise<void>;
  close(): Promise<void>;
}

const migrationsFolder = fileURLToPath(new URL("./migrations", import.meta.url));

/** Postgres, если задан `DATABASE_URL` (прод), иначе PGlite (dev и тесты, без Docker). */
export async function createDb(options: CreateDbOptions = {}): Promise<DbHandle> {
  const url = options.url ?? process.env.DATABASE_URL;
  if (url) {
    const client = postgres(url, { onnotice: () => {} });
    const db = drizzlePostgres(client, { schema });
    return {
      db,
      driver: "postgres",
      migrate: () => migratePostgres(db, { migrationsFolder }),
      close: () => client.end(),
    };
  }
  const client = options.pgliteDir ? new PGlite(options.pgliteDir) : new PGlite();
  await client.waitReady;
  const db = drizzlePglite(client, { schema });
  return {
    db,
    driver: "pglite",
    migrate: () => migratePglite(db, { migrationsFolder }),
    close: () => client.close(),
  };
}

/** БД приложения и скриптов: `DATABASE_URL` или PGlite в `PGLITE_DIR` (по умолчанию `.pglite`). */
export function createDbFromEnv(): Promise<DbHandle> {
  return createDb({ pgliteDir: process.env.PGLITE_DIR || ".pglite" });
}
