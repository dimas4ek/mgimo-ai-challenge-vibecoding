import { defineConfig } from "drizzle-kit";

// Только для `pnpm db:generate`: drizzle-kit сравнивает схему со снимком и пишет SQL-миграцию.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
});
