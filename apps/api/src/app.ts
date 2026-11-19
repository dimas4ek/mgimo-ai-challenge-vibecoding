import type { Health } from "@aihs/contract";
import { Hono } from "hono";

/** Hono-приложение без запуска сервера: его же используют тесты через `app.request()`. */
export const app = new Hono();

app.get("/api/health", (c) => c.json({ status: "ok" } satisfies Health));
