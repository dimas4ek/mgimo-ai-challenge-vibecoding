import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type DbHandle } from "./client";

describe("createDb (PGlite в памяти)", () => {
  let handle: DbHandle;

  beforeAll(async () => {
    handle = await createDb({ url: "" });
    await handle.migrate();
  });

  afterAll(async () => {
    await handle.close();
  });

  it("без DATABASE_URL работает на PGlite", () => {
    expect(handle.driver).toBe("pglite");
  });

  it("миграции создают все таблицы схемы", async () => {
    // execute() на общем типе Db возвращает unknown: форма результата у драйверов разная, здесь PGlite.
    const res = (await handle.db.execute(
      sql`select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
    )) as { rows: { table_name: string }[] };
    expect(res.rows.map((r) => r.table_name)).toEqual([
      "certificates",
      "faculties",
      "grades",
      "groups",
      "lesson_changes",
      "lessons",
      "notifications",
      "request_history",
      "requests",
      "seed_meta",
      "semesters",
      "sessions",
      "students",
      "subjects",
      "teachers",
      "users",
    ]);
  });
});
