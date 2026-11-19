import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

/** Запуск моков в браузере. Импортируется динамически и только в dev (см. main.tsx). */
export async function startMocks(): Promise<void> {
  await setupWorker(...handlers).start({ onUnhandledFrame: "bypass", quiet: true });
}
