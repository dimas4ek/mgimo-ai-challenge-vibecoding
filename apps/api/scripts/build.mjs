// Сборка API в один файл dist/index.js. Скрипт на Node, чтобы одинаково работать на Linux и Windows.
import { cpSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = fileURLToPath(new URL("../dist", import.meta.url));

rmSync(dist, { recursive: true, force: true });

await build({
  absWorkingDir: root,
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  // Свои wasm- и нативные файлы эти пакеты ищут рядом с собой: в бандл их не кладём.
  external: ["@electric-sql/pglite", "@node-rs/argon2", "postgres"],
  // CommonJS-зависимостям внутри ESM-бандла нужен require.
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  logLevel: "info",
});

// db/client.ts ищет миграции рядом с собой: в бандле это dist/migrations.
cpSync(
  fileURLToPath(new URL("../src/db/migrations", import.meta.url)),
  fileURLToPath(new URL("../dist/migrations", import.meta.url)),
  { recursive: true },
);
