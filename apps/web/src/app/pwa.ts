import { API_CACHE } from "../pwa-cache";

/** Удалить офлайн-кэш API: при выходе данные студента не должны оставаться на устройстве. */
export async function clearApiCache(): Promise<void> {
  try {
    if ("caches" in globalThis) await caches.delete(API_CACHE);
  } catch {
    // Нет Cache Storage (старый браузер, приватный режим) — чистить нечего.
  }
}
