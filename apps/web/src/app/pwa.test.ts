import { afterEach, describe, expect, it, vi } from "vitest";
import { API_CACHE } from "../pwa-cache";
import { clearApiCache } from "./pwa";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("clearApiCache", () => {
  it("удаляет офлайн-кэш API (вызывается при выходе)", async () => {
    const remove = vi.fn(async () => true);
    vi.stubGlobal("caches", { delete: remove });
    await clearApiCache();
    expect(remove).toHaveBeenCalledWith(API_CACHE);
  });

  it("без Cache Storage и при ошибке не падает", async () => {
    await expect(clearApiCache()).resolves.toBeUndefined();
    vi.stubGlobal("caches", {
      delete: async () => {
        throw new Error("SecurityError");
      },
    });
    await expect(clearApiCache()).resolves.toBeUndefined();
  });
});
