/**
 * {@link fetchCatalogPanelCode}: URL construction (`<base>/panel.js`), per-hash
 * cache + in-flight dedupe (two calls share ONE fetch), size-cap rejection (by
 * declared length AND by read text), and soft-failure eviction (a rejected
 * fetch does not poison the cache, so a later call retries).
 */
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import {
  __resetCatalogPanelCodeCache,
  fetchCatalogPanelCode,
  PANEL_CODE_SIZE_CAP,
  type PanelCodeFetch,
} from "./catalog-panel-code";

afterEach(() => __resetCatalogPanelCodeCache());

/** A fake `Response` with a body + optional content-length header. */
function okResponse(body: string, contentLength?: number): Response {
  return {
    ok: true,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "content-length" && contentLength !== undefined
          ? String(contentLength)
          : null,
    },
    text: () => Promise.resolve(body),
  } as unknown as Response;
}

function notOkResponse(status: number): Response {
  return {
    ok: false,
    status,
    headers: { get: () => null },
    text: () => Promise.resolve(""),
  } as unknown as Response;
}

describe("fetchCatalogPanelCode", () => {
  test("fetches <artifactBaseUrl>/panel.js and returns the code", async () => {
    const fetchImpl = vi.fn<PanelCodeFetch>(() =>
      Promise.resolve(okResponse("module.exports.default = 1;")),
    );
    const code = await fetchCatalogPanelCode("h1", "https://cdn/c/h1", fetchImpl);
    expect(code).toBe("module.exports.default = 1;");
    expect(fetchImpl).toHaveBeenCalledWith("https://cdn/c/h1/panel.js");
  });

  test("dedupes concurrent calls for the same hash into ONE fetch", async () => {
    const fetchImpl = vi.fn<PanelCodeFetch>(() => Promise.resolve(okResponse("code")));
    const [a, b] = await Promise.all([
      fetchCatalogPanelCode("h1", "https://cdn/c/h1", fetchImpl),
      fetchCatalogPanelCode("h1", "https://cdn/c/h1", fetchImpl),
    ]);
    expect(a).toBe("code");
    expect(b).toBe("code");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test("caches a resolved bundle: a second call does not refetch", async () => {
    const fetchImpl = vi.fn<PanelCodeFetch>(() => Promise.resolve(okResponse("code")));
    await fetchCatalogPanelCode("h1", "https://cdn/c/h1", fetchImpl);
    await fetchCatalogPanelCode("h1", "https://cdn/c/h1", fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test("rejects an oversized body by declared content-length → null", async () => {
    const fetchImpl = vi.fn<PanelCodeFetch>(() =>
      Promise.resolve(okResponse("x", PANEL_CODE_SIZE_CAP + 1)),
    );
    expect(await fetchCatalogPanelCode("h1", "https://cdn/c/h1", fetchImpl)).toBeNull();
  });

  test("rejects an oversized body by read text length → null", async () => {
    const oversized = "a".repeat(PANEL_CODE_SIZE_CAP + 1);
    const fetchImpl = vi.fn<PanelCodeFetch>(() => Promise.resolve(okResponse(oversized)));
    expect(await fetchCatalogPanelCode("h1", "https://cdn/c/h1", fetchImpl)).toBeNull();
  });

  test("a non-ok response → null", async () => {
    const fetchImpl = vi.fn<PanelCodeFetch>(() => Promise.resolve(notOkResponse(404)));
    expect(await fetchCatalogPanelCode("h1", "https://cdn/c/h1", fetchImpl)).toBeNull();
  });

  test("a rejected fetch → null AND is evicted so a later call retries", async () => {
    const failing = vi.fn<PanelCodeFetch>(() => Promise.reject(new Error("network")));
    expect(await fetchCatalogPanelCode("h1", "https://cdn/c/h1", failing)).toBeNull();

    // A subsequent call is NOT served the cached failure — it refetches (and here
    // succeeds), proving the soft failure did not poison the cache.
    const ok = vi.fn<PanelCodeFetch>(() => Promise.resolve(okResponse("code")));
    expect(await fetchCatalogPanelCode("h1", "https://cdn/c/h1", ok)).toBe("code");
    expect(ok).toHaveBeenCalledTimes(1);
  });
});
